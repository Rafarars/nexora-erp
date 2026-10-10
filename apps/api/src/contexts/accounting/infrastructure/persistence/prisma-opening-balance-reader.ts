import { Injectable } from '@nestjs/common';
import { amountUnits, roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import type {
  OpeningBalanceReader,
  OpeningBalanceTotals,
} from '../../domain/opening-balance/opening-balance-reader.js';

@Injectable()
export class PrismaOpeningBalanceReader implements OpeningBalanceReader {
  constructor(private readonly prisma: PrismaService) {}

  async hasOpeningBalance(tenantId: string): Promise<boolean> {
    const count = await this.prisma.journalEntry.count({
      where: {
        tenantId,
        originType: 'opening_balance',
      },
    });

    return count > 0;
  }

  async readBalances(tenantId: string, decimals: number): Promise<OpeningBalanceTotals> {
    // 1. Clientes por cobrar: saldo vivo calculado directamente en SQL (facturas emitidas menos cobros confirmados)
    const [receivablesRow] = await this.prisma.$queryRaw<{ open_balance: string | null }[]>`
      SELECT COALESCE(SUM(balance), 0)::text AS open_balance
      FROM (
        SELECT ROUND((i.total - COALESCE(SUM(a.amount) FILTER (WHERE p.status = 'confirmed'), 0))
                 * CASE WHEN i.currency = i.base_currency OR i.exchange_rate IS NULL THEN 1 ELSE i.exchange_rate / i.base_exchange_rate END, ${decimals}::int) AS balance
        FROM invoices i
        LEFT JOIN payment_allocations a ON a.tenant_id = i.tenant_id AND a.invoice_id = i.id
        LEFT JOIN customer_payments p ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
        WHERE i.tenant_id = ${tenantId}::uuid AND i.status = 'issued'
        GROUP BY i.id, i.due_date, i.total, i.currency, i.base_currency, i.exchange_rate, i.base_exchange_rate
      ) open
      WHERE balance > 0`;

    const receivablesTotal = Number(receivablesRow?.open_balance ?? 0);

    // 2. Proveedores por pagar: saldo vivo calculado directamente en SQL (facturas confirmadas menos pagos confirmados)
    const [payablesRow] = await this.prisma.$queryRaw<{ open_balance: string | null }[]>`
      SELECT COALESCE(SUM(balance), 0)::text AS open_balance
      FROM (
        SELECT ROUND((pi.total - COALESCE(SUM(spa.amount) FILTER (WHERE sp.status = 'confirmed'), 0))
                 * CASE WHEN pi.currency = pi.base_currency OR pi.exchange_rate IS NULL THEN 1 ELSE pi.exchange_rate / pi.base_exchange_rate END, ${decimals}::int) AS balance
        FROM purchase_invoices pi
        LEFT JOIN supplier_payment_allocations spa ON spa.tenant_id = pi.tenant_id AND spa.invoice_id = pi.id
        LEFT JOIN supplier_payments sp ON sp.tenant_id = spa.tenant_id AND sp.id = spa.payment_id
        WHERE pi.tenant_id = ${tenantId}::uuid AND pi.status = 'confirmed'
        GROUP BY pi.id, pi.due_date, pi.total, pi.currency, pi.base_currency, pi.exchange_rate, pi.base_exchange_rate
      ) open
      WHERE balance > 0`;

    const payablesTotal = Number(payablesRow?.open_balance ?? 0);

    // 3. Inventario en bodega: valuación al costo promedio de existencias activas
    const stocks = await this.prisma.itemStock.findMany({
      where: {
        tenantId,
        quantity: { not: 0 },
      },
      select: {
        quantity: true,
        averageCost: true,
      },
    });

    const inventoryUnits = stocks.reduce((sum, row) => {
      const rowValuation = roundRatio(
        amountUnits(Number(row.quantity)) * BigInt(Math.round(Number(row.averageCost) * 1_000_000)),
        1_000_000n,
        decimals,
      );
      return sum + rowValuation;
    }, 0n);

    const inventoryTotal = unitsToNumber(inventoryUnits);

    return {
      inventoryTotal,
      receivablesTotal,
      payablesTotal,
    };
  }
}
