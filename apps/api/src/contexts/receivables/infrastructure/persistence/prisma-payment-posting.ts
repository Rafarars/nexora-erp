import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  CreditNoteCurrencyMismatchError,
  CreditNoteCustomerMismatchError,
  CreditNoteExceededError,
  CreditNoteNotConfirmedError,
  CreditNoteNotFoundError,
  IssuePaymentCannotBeCancelledDirectlyError,
  PaymentNotFoundError,
} from '../../domain/errors/receivables.errors.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { NoteCredit } from '../../domain/credit-note/note-credit.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CREDIT_NOTE_INCLUDE, creditNoteFromRow, CreditNoteRow, PAYMENT_INCLUDE, invoiceFromRow, invoiceSelect, paymentFromRow } from './receivables-rows.js';
import { queryAppliedPaymentsSum } from './credit-note-applied-query.js';

// Orden de bloqueo: cobro y despues sus facturas por identificador. Ventas, al anular una factura,
// solo bloquea esa factura; al emitir, bloquea el cliente y no facturas. No hay ciclo posible.
@Injectable()
export class PrismaPaymentPosting implements PaymentPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(tenantId: TenantId, paymentId: PaymentId, work: (payment: CustomerPayment, invoices: ReceivableInvoice[]) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM customer_payments WHERE tenant_id = ${tenant}::uuid AND id = ${paymentId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new PaymentNotFoundError(paymentId.value);

      const payment = paymentFromRow(await tx.customerPayment.findFirstOrThrow({ where: { tenantId: tenant, id: paymentId.value }, include: PAYMENT_INCLUDE }));

      if (payment.toPrimitives().creditSourceId) {
        const creditSourceId = payment.toPrimitives().creditSourceId!;
        const lockedNote = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM customer_credit_notes WHERE tenant_id = ${tenant}::uuid AND id = ${creditSourceId}::uuid FOR UPDATE`;

        if (lockedNote.length === 0) {
          throw new CreditNoteNotFoundError(creditSourceId);
        }

        const noteRow = (await tx.customerCreditNote.findFirstOrThrow({
          where: { tenantId: tenant, id: creditSourceId },
          include: CREDIT_NOTE_INCLUDE,
        })) as unknown as CreditNoteRow;

        const note = creditNoteFromRow(noteRow);

        if (note.currentStatus() !== 'confirmed') {
          throw new CreditNoteNotConfirmedError(creditSourceId, note.currentStatus());
        }

        if (note.customerId() !== payment.customerId()) {
          throw new CreditNoteCustomerMismatchError(creditSourceId, payment.customerId());
        }

        if (note.currency().currency !== payment.currency().currency) {
          throw new CreditNoteCurrencyMismatchError(note.currency().currency, payment.currency().currency);
        }

        // Sumar cobros confirmados aplicados a la nota (excluyendo el actual)
        const appliedSum = await queryAppliedPaymentsSum(tx, tenant, creditSourceId, paymentId.value);
        const available = NoteCredit.available(note.total(), appliedSum);

        if (payment.toPrimitives().amount > available) {
          throw new CreditNoteExceededError(creditSourceId, available, payment.toPrimitives().amount);
        }
      }

      const ids = [...payment.invoiceIds()].sort();

      await tx.$queryRaw`SELECT id FROM invoices WHERE tenant_id = ${tenant}::uuid AND id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;

      // Leidas despues del bloqueo: ven lo que confirmo el cobro que esperaba antes en la fila.
      const invoices = await tx.invoice.findMany({ where: { tenantId: tenant, id: { in: ids } }, select: invoiceSelect(paymentId.value) });

      const wasStatus = payment.currentStatus();
      work(payment, invoices.map(invoiceFromRow));
      const nowStatus = payment.currentStatus();

      if (wasStatus !== 'cancelled' && nowStatus === 'cancelled') {
        const issueNote = await tx.customerCreditNote.findFirst({
          where: {
            tenantId: tenant,
            issuePaymentId: paymentId.value,
            status: { not: 'cancelled' },
          },
        });

        if (issueNote) {
          throw new IssuePaymentCannotBeCancelledDirectlyError(paymentId.value, issueNote.id);
        }
      }

      const { status, confirmedAt, cancelledAt, updatedAt, amount, amountVes, currency, exchangeRate, baseCurrency, baseExchangeRate, manualExchangeRate, allocations } =
        payment.toPrimitives();

      // Confirmar congela las tasas: se escriben con el importe y el diferencial de cada factura.
      await tx.customerPayment.update({
        where: { tenantId_id: { tenantId: tenant, id: paymentId.value } },
        data: { status, confirmedAt, cancelledAt, updatedAt, amount, amountVes, currency, exchangeRate, baseCurrency, baseExchangeRate, manualExchangeRate },
      });

      for (const allocation of allocations) {
        await tx.paymentAllocation.update({ where: { id: allocation.id }, data: { exchangeRate: allocation.exchangeRate, exchangeDifference: allocation.exchangeDifference } });
      }
    });
  }
}
