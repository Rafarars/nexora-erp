import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import {
  CreditNoteCurrencyMismatchError,
  CreditNoteNotConfirmedError,
  CreditNoteNotFoundError,
  PaymentNotFoundError,
} from '../../domain/errors/payables.errors.js';
import { PayableInvoice } from '../../domain/ledger/payable-invoice.js';
import { SupplierPayment, PaymentId } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentPosting } from '../../domain/payment/posting/supplier-payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PAYMENT_INCLUDE, invoiceFromRow, invoiceSelect, paymentFromRow } from './payables-rows.js';

// Bloqueo determinista (nota -> pago -> facturas) para evitar deadlocks
@Injectable()
export class PrismaSupplierPaymentPosting implements SupplierPaymentPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(tenantId: TenantId, paymentId: PaymentId, work: (payment: SupplierPayment, invoices: PayableInvoice[]) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const peek = await tx.supplierPayment.findFirst({
        where: { tenantId: tenant, id: paymentId.value },
        select: { creditSourceId: true },
      });

      if (peek?.creditSourceId) {
        const lockedNote = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM supplier_credit_notes WHERE tenant_id = ${tenant}::uuid AND id = ${peek.creditSourceId}::uuid FOR UPDATE`;

        if (lockedNote.length === 0) {
          throw new CreditNoteNotFoundError(peek.creditSourceId);
        }
      }

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM supplier_payments WHERE tenant_id = ${tenant}::uuid AND id = ${paymentId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new PaymentNotFoundError(paymentId.value);

      const payment = paymentFromRow(await tx.supplierPayment.findFirstOrThrow({ where: { tenantId: tenant, id: paymentId.value }, include: PAYMENT_INCLUDE }));

      if (payment.toPrimitives().creditSourceId !== (peek?.creditSourceId ?? null)) {
        throw new ConcurrentModificationError(paymentId.value);
      }

      if (payment.toPrimitives().creditSourceId) {
        const creditSourceId = payment.toPrimitives().creditSourceId!;
        const noteRow = await tx.supplierCreditNote.findFirstOrThrow({
          where: { tenantId: tenant, id: creditSourceId },
        });

        if (noteRow.status !== 'confirmed') {
          throw new CreditNoteNotConfirmedError(creditSourceId, noteRow.status);
        }

        if (noteRow.currency !== payment.currency().currency) {
          throw new CreditNoteCurrencyMismatchError(noteRow.currency, payment.currency().currency);
        }
      }

      const ids = [...payment.invoiceIds()].sort();

      if (ids.length > 0) {
        await tx.$queryRaw`SELECT id FROM purchase_invoices WHERE tenant_id = ${tenant}::uuid AND id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
      }

      // Leidas despues del bloqueo: ven lo que confirmo el pago que esperaba antes en la fila.
      const invoices = await tx.purchaseInvoice.findMany({ where: { tenantId: tenant, id: { in: ids } }, select: invoiceSelect(paymentId.value) });

      work(payment, invoices.map(invoiceFromRow));

      const { status, confirmedAt, cancelledAt, updatedAt, amount, amountVes, currency, exchangeRate, baseCurrency, baseExchangeRate, manualExchangeRate, allocations } =
        payment.toPrimitives();

      // Confirmar congela las tasas: se escriben con el importe y el diferencial de cada factura.
      await tx.supplierPayment.update({
        where: { tenantId_id: { tenantId: tenant, id: paymentId.value } },
        data: { status, confirmedAt, cancelledAt, updatedAt, amount, amountVes, currency, exchangeRate, baseCurrency, baseExchangeRate, manualExchangeRate },
      });

      for (const allocation of allocations) {
        await tx.supplierPaymentAllocation.update({ where: { id: allocation.id }, data: { exchangeRate: allocation.exchangeRate, exchangeDifference: allocation.exchangeDifference } });
      }
    });
  }
}
