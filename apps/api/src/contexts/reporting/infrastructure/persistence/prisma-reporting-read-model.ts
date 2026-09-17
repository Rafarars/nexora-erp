import { Injectable } from '@nestjs/common';
import { raw, sql } from '../../../../generated/prisma/internal/prismaNamespace.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ReportPeriod } from '../../domain/period/report-period.js';
import {
  ReportCompany,
  ReportCustomer,
  ReportCustomerSales,
  ReportInvoice,
  ReportItemSales,
  ReportStatementEntry,
  ReportStock,
  ReportingReadModel,
} from '../../domain/read-model/reporting-read-model.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

const day = (value: Date) => value.toISOString().slice(0, 10);
const num = (value: string | number | null) => Number(value ?? 0);

// De la moneda del documento a la de la empresa, con las dos tasas que congelo: lo anterior al
// multimoneda no las tiene y ya estaba en la moneda de la empresa.
const factor = (table: string) =>
  sql`CASE WHEN ${raw(table)}.currency = ${raw(table)}.base_currency OR ${raw(table)}.exchange_rate IS NULL THEN 1 ELSE ${raw(table)}.exchange_rate / ${raw(table)}.base_exchange_rate END`;

const IN_COMPANY_CURRENCY = factor('i');
const RECEIPT_IN_COMPANY_CURRENCY = factor('r');
const PAYMENT_IN_COMPANY_CURRENCY = factor('p');

// Consultas de solo lectura sobre las tablas de ventas, compras, cobranza e inventario. Las sumas
// se hacen en PostgreSQL con decimales exactos y llegan como texto, para no perder centimos.
@Injectable()
export class PrismaReportingReadModel implements ReportingReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async company(tenantId: TenantId): Promise<ReportCompany> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId.value },
      select: { name: true, profile: { select: { legalName: true, fiscalId: true } } },
    });

    return { name: tenant.profile?.legalName ?? tenant.name, fiscalId: tenant.profile?.fiscalId ?? null };
  }

  async customers(tenantId: TenantId): Promise<ReportCustomer[]> {
    const rows = await this.prisma.customer.findMany({
      where: { tenantId: tenantId.value },
      select: { id: true, code: true, name: true, fiscalId: true, paymentTermDays: true, creditLimit: true },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({ ...row, creditLimit: row.creditLimit === null ? null : row.creditLimit.toNumber() }));
  }

  async warehouseExists(tenantId: TenantId, warehouseId: string): Promise<boolean> {
    return (await this.prisma.warehouse.count({ where: { tenantId: tenantId.value, id: warehouseId } })) > 0;
  }

  async issuedInvoices(tenantId: TenantId, decimals: number, customerId?: string): Promise<ReportInvoice[]> {
    // Lo aplicado se escribe en la moneda de su factura, asi que se convierte con las tasas de ella.
    const rows = await this.prisma.$queryRaw<{ id: string; code: string; customer_id: string; issue_date: Date; due_date: Date; total: string; paid: string; balance: string }[]>`
      SELECT i.id, i.code, i.customer_id, i.issue_date, i.due_date,
             ROUND(i.total * ${IN_COMPANY_CURRENCY}, ${decimals}::int)::text AS total,
             ROUND(COALESCE(SUM(a.amount) FILTER (WHERE p.status = 'confirmed'), 0) * ${IN_COMPANY_CURRENCY}, ${decimals}::int)::text AS paid,
             ROUND((i.total - COALESCE(SUM(a.amount) FILTER (WHERE p.status = 'confirmed'), 0)) * ${IN_COMPANY_CURRENCY}, ${decimals}::int)::text AS balance
      FROM invoices i
      LEFT JOIN payment_allocations a ON a.tenant_id = i.tenant_id AND a.invoice_id = i.id
      LEFT JOIN customer_payments p ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
      WHERE i.tenant_id = ${tenantId.value}::uuid AND i.status = 'issued'
        AND (${customerId ?? null}::uuid IS NULL OR i.customer_id = ${customerId ?? null}::uuid)
      GROUP BY i.id
      ORDER BY i.code`;

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      customerId: row.customer_id,
      issueDate: day(row.issue_date),
      dueDate: day(row.due_date),
      total: num(row.total),
      paid: num(row.paid),
      balance: num(row.balance),
    }));
  }

  // Un cobro rebaja lo que valia el saldo de cada factura antes menos lo que vale despues, como en
  // cobranza: convertir cada abono por su cuenta perderia centimos y el saldo corrido no cerraria.
  async statementEntries(tenantId: TenantId, customerId: string, decimals: number): Promise<ReportStatementEntry[]> {
    const rows = await this.prisma.$queryRaw<{ date: Date; type: 'invoice' | 'payment'; code: string; amount: string }[]>`
      WITH applied AS (
        SELECT a.invoice_id, a.amount, p.payment_date, p.code,
               SUM(a.amount) OVER (PARTITION BY a.invoice_id ORDER BY p.payment_date, p.code, a.id) AS paid_after
        FROM payment_allocations a
        JOIN customer_payments p ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
        WHERE a.tenant_id = ${tenantId.value}::uuid AND p.customer_id = ${customerId}::uuid AND p.status = 'confirmed'
      )
      SELECT i.issue_date AS date, 'invoice' AS type, i.code, ROUND(i.total * ${IN_COMPANY_CURRENCY}, ${decimals}::int)::text AS amount
      FROM invoices i
      WHERE i.tenant_id = ${tenantId.value}::uuid AND i.customer_id = ${customerId}::uuid AND i.status = 'issued'
      UNION ALL
      SELECT applied.payment_date, 'payment', applied.code,
             SUM(
               ROUND((i.total - applied.paid_after + applied.amount) * ${IN_COMPANY_CURRENCY}, ${decimals}::int)
               - ROUND((i.total - applied.paid_after) * ${IN_COMPANY_CURRENCY}, ${decimals}::int)
             )::text
      FROM applied
      JOIN invoices i ON i.tenant_id = ${tenantId.value}::uuid AND i.id = applied.invoice_id
      GROUP BY applied.payment_date, applied.code`;

    return rows.map((row) => ({ date: day(row.date), type: row.type, code: row.code, amount: num(row.amount) }));
  }

  async salesTotal(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(ROUND(total * ${IN_COMPANY_CURRENCY}, ${decimals}::int)), 0)::text AS total FROM invoices i
      WHERE tenant_id = ${tenantId.value}::uuid AND status = 'issued'
        AND issue_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date`;

    return num(row.total);
  }

  async purchasesTotal(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<number> {
    // Redondeado por linea y llevado a la moneda de la empresa con las tasas de la entrada.
    const [row] = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(ROUND(ROUND(l.quantity * l.unit_cost, ${decimals}::int) * ${RECEIPT_IN_COMPANY_CURRENCY}, ${decimals}::int)), 0)::text AS total
      FROM goods_receipts r JOIN goods_receipt_lines l ON l.tenant_id = r.tenant_id AND l.receipt_id = r.id
      WHERE r.tenant_id = ${tenantId.value}::uuid AND r.status = 'confirmed'
        AND r.receipt_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date`;

    return num(row.total);
  }

  async collectedTotal(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(ROUND(amount * ${PAYMENT_IN_COMPANY_CURRENCY}, ${decimals}::int)), 0)::text AS total FROM customer_payments p
      WHERE tenant_id = ${tenantId.value}::uuid AND status = 'confirmed'
        AND payment_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date`;

    return num(row.total);
  }

  async salesByCustomer(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<ReportCustomerSales[]> {
    const rows = await this.prisma.$queryRaw<{ customer_id: string; invoices: bigint; subtotal: string; tax: string; total: string }[]>`
      SELECT customer_id, COUNT(*) AS invoices,
             SUM(ROUND(subtotal * ${IN_COMPANY_CURRENCY}, ${decimals}::int))::text AS subtotal,
             SUM(ROUND(tax * ${IN_COMPANY_CURRENCY}, ${decimals}::int))::text AS tax,
             SUM(ROUND(total * ${IN_COMPANY_CURRENCY}, ${decimals}::int))::text AS total
      FROM invoices i
      WHERE tenant_id = ${tenantId.value}::uuid AND status = 'issued'
        AND issue_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date
      GROUP BY customer_id`;

    return rows.map((row) => ({ customerId: row.customer_id, invoices: Number(row.invoices), subtotal: num(row.subtotal), tax: num(row.tax), total: num(row.total) }));
  }

  async salesByItem(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<ReportItemSales[]> {
    const rows = await this.prisma.$queryRaw<{ item_id: string; sku: string; name: string; subtotal: string }[]>`
      SELECT l.item_id, it.sku, it.name, SUM(ROUND(l.subtotal * ${IN_COMPANY_CURRENCY}, ${decimals}::int))::text AS subtotal
      FROM invoices i
      JOIN invoice_lines l ON l.tenant_id = i.tenant_id AND l.invoice_id = i.id
      JOIN items it ON it.tenant_id = l.tenant_id AND it.id = l.item_id
      WHERE i.tenant_id = ${tenantId.value}::uuid AND i.status = 'issued'
        AND i.issue_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date
      GROUP BY l.item_id, it.sku, it.name`;

    return rows.map((row) => ({ itemId: row.item_id, sku: row.sku, name: row.name, subtotal: num(row.subtotal) }));
  }

  async stock(tenantId: TenantId, warehouseId?: string): Promise<ReportStock[]> {
    const rows = await this.prisma.$queryRaw<{ warehouse_id: string; warehouse_name: string; item_id: string; sku: string; name: string; base_unit: string | null; quantity: string; average_cost: string }[]>`
      SELECT s.warehouse_id, w.name AS warehouse_name, s.item_id, it.sku, it.name, u.abbreviation AS base_unit,
             s.quantity::text, s.average_cost::text
      FROM item_stocks s
      JOIN warehouses w ON w.tenant_id = s.tenant_id AND w.id = s.warehouse_id
      JOIN items it ON it.tenant_id = s.tenant_id AND it.id = s.item_id
      LEFT JOIN item_units iu ON iu.item_id = s.item_id AND iu.is_base
      LEFT JOIN measurement_units u ON u.tenant_id = iu.tenant_id AND u.id = iu.unit_id
      WHERE s.tenant_id = ${tenantId.value}::uuid AND s.quantity <> 0
        AND (${warehouseId ?? null}::uuid IS NULL OR s.warehouse_id = ${warehouseId ?? null}::uuid)`;

    return rows.map((row) => ({
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      itemId: row.item_id,
      sku: row.sku,
      name: row.name,
      baseUnit: row.base_unit ?? '',
      quantity: num(row.quantity),
      averageCost: num(row.average_cost),
    }));
  }
}
