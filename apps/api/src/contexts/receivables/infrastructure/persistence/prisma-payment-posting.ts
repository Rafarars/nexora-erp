import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PaymentNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PAYMENT_INCLUDE, invoiceFromRow, invoiceSelect, paymentFromRow } from './receivables-rows.js';

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
    });
  }
}
