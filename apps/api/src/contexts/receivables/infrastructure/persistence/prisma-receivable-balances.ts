import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { CustomerExposure, ReceivableBalances } from '../../../../shared/prisma/receivable-balances.js';

// Implementa lo que cuentas por cobrar publica para ventas. El saldo se calcula en SQL: facturas
// emitidas menos lo aplicado por cobros confirmados, llevado a la moneda de la empresa con las tasas
// de cada factura.
@Injectable()
export class PrismaReceivableBalances implements ReceivableBalances {
  async lockCustomer(tx: TransactionClient, tenantId: string, customerId: string, today: string): Promise<CustomerExposure> {
    await tx.$queryRaw`SELECT id FROM customers WHERE tenant_id = ${tenantId}::uuid AND id = ${customerId}::uuid FOR UPDATE`;

    return this.exposure(tx, tenantId, customerId, today);
  }

  async exposure(db: TransactionClient, tenantId: string, customerId: string, today: string): Promise<CustomerExposure> {
    const [row] = await db.$queryRaw<{ open_balance: string | null; overdue: bigint }[]>`
      SELECT COALESCE(SUM(balance), 0)::text AS open_balance,
             COUNT(*) FILTER (WHERE due_date < ${today}::date) AS overdue
      FROM (
        SELECT i.due_date,
               ROUND((i.total - COALESCE(SUM(a.amount) FILTER (WHERE p.status = 'confirmed'), 0))
                 * CASE WHEN i.currency = i.base_currency OR i.exchange_rate IS NULL THEN 1 ELSE i.exchange_rate / i.base_exchange_rate END, 4) AS balance
        FROM invoices i
        LEFT JOIN payment_allocations a ON a.tenant_id = i.tenant_id AND a.invoice_id = i.id
        LEFT JOIN customer_payments p ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
        WHERE i.tenant_id = ${tenantId}::uuid AND i.customer_id = ${customerId}::uuid AND i.status = 'issued'
        GROUP BY i.id, i.due_date, i.total, i.currency, i.base_currency, i.exchange_rate, i.base_exchange_rate
      ) open
      WHERE balance > 0`;

    return { openBalance: Number(row.open_balance ?? 0), hasOverdue: Number(row.overdue) > 0 };
  }

  async paidOf(tx: TransactionClient, tenantId: string, invoiceId: string): Promise<number> {
    const [row] = await tx.$queryRaw<{ paid: string }[]>`
      SELECT COALESCE(SUM(a.amount), 0)::text AS paid
      FROM payment_allocations a
      JOIN customer_payments p ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
      WHERE a.tenant_id = ${tenantId}::uuid AND a.invoice_id = ${invoiceId}::uuid AND p.status = 'confirmed'`;

    return Number(row.paid);
  }
}
