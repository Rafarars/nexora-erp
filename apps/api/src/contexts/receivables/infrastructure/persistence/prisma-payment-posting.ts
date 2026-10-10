import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_ACCOUNTING_POSTING, type DocumentAccountingPosting } from '../../../../shared/prisma/document-accounting-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteCurrencyMismatchError,
  CreditNoteCustomerMismatchError,
  CreditNoteExceededError,
  CreditNoteNotConfirmedError,
  CreditNoteNotFoundError,
  PaymentNotFoundError,
} from '../../domain/errors/receivables.errors.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { NoteCredit } from '../../domain/credit-note/note-credit.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CREDIT_NOTE_INCLUDE, creditNoteFromRow, CreditNoteRow, PAYMENT_INCLUDE, invoiceFromRow, invoiceSelect, paymentFromRow } from './receivables-rows.js';
import { queryAppliedPaymentsSum } from './credit-note-applied-query.js';

// Bloqueo determinista (nota -> cobro -> facturas) para evitar deadlocks con
// PrismaCreditNotePosting, que siempre adquiere la nota antes que su cobro.
@Injectable()
export class PrismaPaymentPosting implements PaymentPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_ACCOUNTING_POSTING) private readonly accounting: DocumentAccountingPosting,
  ) {}

  async post(tenantId: TenantId, paymentId: PaymentId, work: (payment: CustomerPayment, invoices: ReceivableInvoice[]) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const peek = await tx.customerPayment.findFirst({
        where: { tenantId: tenant, id: paymentId.value },
        select: { creditSourceId: true },
      });

      if (peek?.creditSourceId) {
        const lockedNote = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM customer_credit_notes WHERE tenant_id = ${tenant}::uuid AND id = ${peek.creditSourceId}::uuid FOR UPDATE`;

        if (lockedNote.length === 0) {
          throw new CreditNoteNotFoundError(peek.creditSourceId);
        }
      }

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM customer_payments WHERE tenant_id = ${tenant}::uuid AND id = ${paymentId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new PaymentNotFoundError(paymentId.value);

      const payment = paymentFromRow(await tx.customerPayment.findFirstOrThrow({ where: { tenantId: tenant, id: paymentId.value }, include: PAYMENT_INCLUDE }));

      if (payment.toPrimitives().creditSourceId !== (peek?.creditSourceId ?? null)) {
        throw new ConcurrentModificationError(paymentId.value);
      }

      if (payment.toPrimitives().creditSourceId) {
        const creditSourceId = payment.toPrimitives().creditSourceId!;
        // La nota ya fue bloqueada arriba con FOR UPDATE en orden determinista
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

      work(payment, invoices.map(invoiceFromRow));

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

      if (status === 'confirmed') {
        const prim = payment.toPrimitives();
        const settings = await tx.companySettings.findUnique({ where: { tenantId: tenant } });
        const decimals = settings?.amountDecimals ?? 2;
        const docCurrency = DocumentCurrency.fromPrimitives(prim);
        const baseAmountPaid = unitsToNumber(docCurrency.baseAmount(amountUnits(prim.amount), decimals));

        if (prim.creditSourceId) {
          await this.accounting.post(tx, tenant, {
            kind: 'payment-received',
            documentId: paymentId.value,
            date: prim.paymentDate,
            amount: baseAmountPaid,
            allocatedAmount: baseAmountPaid,
            exchangeDifference: 0,
            currency: prim.baseCurrency,
            creditSourceId: prim.creditSourceId,
            allocations: [],
          });
        } else {
          let totalAllocatedBaseUnits = 0n;

          for (const a of allocations) {
            const invRow = await tx.invoice.findUnique({
              where: { tenantId_id: { tenantId: tenant, id: a.invoiceId } },
              select: { currency: true, exchangeRate: true, baseCurrency: true, baseExchangeRate: true, manualExchangeRate: true },
            });

            if (invRow) {
              const invCurrency = DocumentCurrency.fromPrimitives({
                currency: invRow.currency,
                exchangeRate: invRow.exchangeRate ? Number(invRow.exchangeRate) : null,
                baseCurrency: invRow.baseCurrency,
                baseExchangeRate: invRow.baseExchangeRate ? Number(invRow.baseExchangeRate) : null,
                manualExchangeRate: invRow.manualExchangeRate,
              });
              totalAllocatedBaseUnits += invCurrency.baseAmount(amountUnits(a.amount), decimals);
            } else {
              totalAllocatedBaseUnits += docCurrency.baseAmount(amountUnits(a.amount), decimals);
            }
          }

          const baseAllocatedAmount = unitsToNumber(totalAllocatedBaseUnits);
          const diffUnits = totalAllocatedBaseUnits - amountUnits(baseAmountPaid);
          const baseExchangeDiff = unitsToNumber(diffUnits);

          await this.accounting.post(tx, tenant, {
            kind: 'payment-received',
            documentId: paymentId.value,
            date: prim.paymentDate,
            amount: baseAmountPaid,
            allocatedAmount: baseAllocatedAmount,
            exchangeDifference: baseExchangeDiff,
            currency: prim.baseCurrency,
            creditSourceId: null,
            allocations: allocations.map((a) => ({
              invoiceId: a.invoiceId,
              amount: a.amount,
              exchangeDifference: a.exchangeDifference ?? 0,
            })),
          });
        }
      } else if (status === 'cancelled') {
        await this.accounting.post(tx, tenant, {
          kind: 'document-cancelled',
          originType: 'customer_payment',
          originId: paymentId.value,
          date: cancelledAt ?? new Date(),
        });
      }
    });
  }
}
