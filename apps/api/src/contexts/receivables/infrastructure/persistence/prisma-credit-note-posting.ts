import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteNotConfirmableError,
  CreditNoteNotFoundError,
  CreditNoteReturnAlreadyCreditedError,
  CreditNoteReturnCustomerMismatchError,
  CreditNoteReturnNotConfirmedError,
  CreditNoteReturnOrderMismatchError,
  CreditNoteWithApplicationsError,
  InvoiceNotPayableError,
  ReceivableInvoiceNotFoundError,
} from '../../domain/errors/receivables.errors.js';
import {
  CreditNoteId,
  CustomerCreditNote,
} from '../../domain/credit-note/customer-credit-note.entity.js';
import { CreditNotePosting } from '../../domain/credit-note/posting/credit-note-posting.js';
import { CreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { RECEIVABLES_CODE_SEQUENCE, type ReceivablesCodeSequence, receivablesCode } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, CREDIT_NOTE_INCLUDE, creditNoteFromRow, CreditNoteRow, invoiceFromRow, invoiceSelect, PAYMENT_INCLUDE, paymentFromRow, PaymentRow } from './receivables-rows.js';

@Injectable()
export class PrismaCreditNotePosting implements CreditNotePosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RECEIVABLES_CODE_SEQUENCE) private readonly codes: ReceivablesCodeSequence,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async confirm(
    tenantId: TenantId,
    noteId: CreditNoteId,
    now: Date,
    today: string,
  ): Promise<{ creditNote: CustomerCreditNote; issuePayment: CustomerPayment | null }> {
    const tenant = tenantId.value;

    return await this.prisma.$transaction(async (tx) => {
      // Orden de bloqueo determinista: customer_credit_notes -> invoices -> sales_returns
      const lockedNotes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM customer_credit_notes
        WHERE tenant_id = ${tenant}::uuid AND id = ${noteId.value}::uuid
        FOR UPDATE`;

      if (lockedNotes.length === 0) {
        throw new CreditNoteNotFoundError(noteId.value);
      }

      const noteRow = (await tx.customerCreditNote.findFirstOrThrow({
        where: { tenantId: tenant, id: noteId.value },
        include: CREDIT_NOTE_INCLUDE,
      })) as unknown as CreditNoteRow;

      const note = creditNoteFromRow(noteRow);

      if (note.currentStatus() !== 'draft') {
        throw new CreditNoteNotConfirmableError(noteId.value, note.currentStatus());
      }

      let issuePayment: CustomerPayment | null = null;

      // 1. Si cita factura: valida cupo de importe y crea cobro si queda saldo vivo
      if (note.invoiceId()) {
        const invoiceId = note.invoiceId()!;
        const lockedInvoices = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM invoices
          WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId}::uuid
          FOR UPDATE`;

        if (lockedInvoices.length === 0) {
          throw new ReceivableInvoiceNotFoundError(invoiceId);
        }

        const invoiceRow = await tx.invoice.findFirstOrThrow({
          where: { tenantId: tenant, id: invoiceId },
          select: invoiceSelect(),
        });

        if (invoiceRow.status !== 'issued') {
          throw new InvoiceNotPayableError(invoiceId);
        }

        const invoice = invoiceFromRow(invoiceRow);

        // Cupo de importe: notas confirmadas anteriores sobre la misma factura
        const otherConfirmedNotes = await tx.customerCreditNote.aggregate({
          where: {
            tenantId: tenant,
            invoiceId,
            status: 'confirmed',
            id: { not: note.id.value },
          },
          _sum: { total: true },
        });

        const alreadyCredited = otherConfirmedNotes._sum.total ? otherConfirmedNotes._sum.total.toNumber() : 0;
        CreditQuota.ensureWithinQuota(invoice.total(), alreadyCredited, note.total(), invoiceId);

        // Saldo vivo de la factura
        const liveBalance = invoice.balance();

        if (liveBalance > 0) {
          const appliedAmount = Math.min(liveBalance, note.total());
          const paymentId = PaymentId.of(this.ids.next());
          const paymentSeq = await this.codes.next(tenantId, 'COB');
          const paymentCode = receivablesCode('COB', paymentSeq);
          const allocationId = this.ids.next();

          const notePrimitives = note.toPrimitives();

          // Crear cobro confirmado que amortiza la factura
          const paymentDetails = {
            customerId: note.customerId(),
            date: note.issueDate(),
            method: 'credit_note',
            creditSourceId: note.id.value,
            reference: `Nota de crédito ${note.code}`,
            notes: notePrimitives.notes,
            allocations: [{ id: allocationId, invoiceId, amount: appliedAmount }],
          };

          const settings = await tx.companySettings.findUnique({
            where: { tenantId: tenant },
            select: { amountDecimals: true },
          });
          const decimals = settings?.amountDecimals ?? 2;

          const invoiceRates = { [invoice.currency().currency]: notePrimitives.exchangeRate ?? 1 };
          const paymentRatesObj = {
            currency: note.currency(),
            invoiceRates,
            decimals,
          };

          issuePayment = CustomerPayment.draft(
            paymentId,
            tenantId,
            paymentCode,
            paymentDetails,
            [invoice],
            paymentRatesObj,
            now,
            today,
          );

          issuePayment.confirm([invoice], paymentRatesObj, now, today);
          const payPrimitives = issuePayment.toPrimitives();

          await tx.customerPayment.create({
            data: {
              id: payPrimitives.id,
              tenantId: tenant,
              code: payPrimitives.code,
              customerId: payPrimitives.customerId,
              paymentDate: asDate(payPrimitives.paymentDate),
              method: payPrimitives.method,
              creditSourceId: payPrimitives.creditSourceId,
              reference: payPrimitives.reference,
              notes: payPrimitives.notes,
              amount: payPrimitives.amount,
              amountVes: payPrimitives.amountVes,
              currency: payPrimitives.currency,
              exchangeRate: payPrimitives.exchangeRate,
              baseCurrency: payPrimitives.baseCurrency,
              baseExchangeRate: payPrimitives.baseExchangeRate,
              manualExchangeRate: payPrimitives.manualExchangeRate,
              status: payPrimitives.status,
              confirmedAt: payPrimitives.confirmedAt,
              cancelledAt: payPrimitives.cancelledAt,
              createdAt: payPrimitives.createdAt,
              updatedAt: payPrimitives.updatedAt,
            },
          });

          await tx.paymentAllocation.createMany({
            data: payPrimitives.allocations.map((a) => ({
              id: a.id,
              tenantId: tenant,
              paymentId: payPrimitives.id,
              invoiceId: a.invoiceId,
              amount: a.amount,
              exchangeRate: a.exchangeRate,
              exchangeDifference: a.exchangeDifference,
            })),
          });

          note.assignIssuePayment(issuePayment.id.value);
        }
      }

      // 2. Si cita devolucion de venta: bloquear con FOR UPDATE, validar mismo pedido y que no este acreditada
      if (note.salesReturnId()) {
        const returnId = note.salesReturnId()!;
        const lockedReturns = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM sales_returns
          WHERE tenant_id = ${tenant}::uuid AND id = ${returnId}::uuid
          FOR UPDATE`;

        if (lockedReturns.length === 0) {
          throw new CreditNoteReturnNotConfirmedError(returnId, 'none');
        }

        const returnRow = await tx.salesReturn.findFirstOrThrow({
          where: { tenantId: tenant, id: returnId },
          include: { dispatch: { select: { orderId: true } } },
        });

        if (returnRow.status !== 'confirmed') {
          throw new CreditNoteReturnNotConfirmedError(returnId, returnRow.status);
        }

        if (returnRow.customerId !== note.customerId()) {
          throw new CreditNoteReturnCustomerMismatchError(returnId, note.customerId());
        }

        // H8 §4.2 regla 2: Si la nota cita factura y devolucion a la vez, la devolucion debe ser del mismo pedido que la factura
        if (note.invoiceId()) {
          const invoiceOrderId = (await tx.invoice.findFirst({
            where: { tenantId: tenant, id: note.invoiceId()! },
            select: { orderId: true },
          }))?.orderId;

          const returnOrderId = returnRow.dispatch?.orderId;
          if (!returnOrderId || !invoiceOrderId || returnOrderId !== invoiceOrderId) {
            throw new CreditNoteReturnOrderMismatchError(returnId, note.invoiceId()!);
          }
        }

        const otherNoteWithReturn = await tx.customerCreditNote.findFirst({
          where: {
            tenantId: tenant,
            salesReturnId: returnId,
            status: 'confirmed',
            id: { not: note.id.value },
          },
        });

        if (otherNoteWithReturn) {
          throw new CreditNoteReturnAlreadyCreditedError(returnId);
        }
      }

      // 3. Confirmar la nota
      note.confirm(now, issuePayment ? issuePayment.id.value : null);
      const updated = note.toPrimitives();

      await tx.customerCreditNote.update({
        where: { tenantId_id: { tenantId: tenant, id: note.id.value } },
        data: {
          status: 'confirmed',
          issuePaymentId: updated.issuePaymentId,
          confirmedAt: updated.confirmedAt,
          updatedAt: updated.updatedAt,
        },
      });

      return { creditNote: note, issuePayment };
    });
  }

  async cancel(tenantId: TenantId, noteId: CreditNoteId, now: Date): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const lockedNotes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM customer_credit_notes
        WHERE tenant_id = ${tenant}::uuid AND id = ${noteId.value}::uuid
        FOR UPDATE`;

      if (lockedNotes.length === 0) {
        throw new CreditNoteNotFoundError(noteId.value);
      }

      const noteRow = (await tx.customerCreditNote.findFirstOrThrow({
        where: { tenantId: tenant, id: noteId.value },
        include: CREDIT_NOTE_INCLUDE,
      })) as unknown as CreditNoteRow;

      const note = creditNoteFromRow(noteRow);

      if (note.currentStatus() === 'cancelled') {
        throw new CreditNoteAlreadyCancelledError(noteId.value);
      }

      // Comprobar si se gasto su credito en cobros confirmados (distintos al cobro de emision)
      const confirmedOtherPaymentsCount = await tx.customerPayment.count({
        where: {
          tenantId: tenant,
          creditSourceId: note.id.value,
          status: 'confirmed',
          ...(note.issuePaymentId() ? { id: { not: note.issuePaymentId()! } } : {}),
        },
      });

      if (confirmedOtherPaymentsCount > 0) {
        throw new CreditNoteWithApplicationsError(note.id.value);
      }

      // Si tiene cobro de emision y esta confirmado, anularlo
      if (note.issuePaymentId()) {
        const issuePaymentRow = await tx.customerPayment.findFirst({
          where: { tenantId: tenant, id: note.issuePaymentId()! },
          include: PAYMENT_INCLUDE,
        });

        if (issuePaymentRow && issuePaymentRow.status === 'confirmed') {
          const payment = paymentFromRow(issuePaymentRow as unknown as PaymentRow);
          payment.cancel(now);

          await tx.customerPayment.update({
            where: { tenantId_id: { tenantId: tenant, id: payment.id.value } },
            data: {
              status: 'cancelled',
              cancelledAt: now,
              updatedAt: now,
            },
          });
        }
      }

      note.cancel(now);

      await tx.customerCreditNote.update({
        where: { tenantId_id: { tenantId: tenant, id: note.id.value } },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        },
      });
    });
  }
}
