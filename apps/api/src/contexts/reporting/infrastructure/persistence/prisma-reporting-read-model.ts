import { Injectable } from '@nestjs/common';
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

  async issuedInvoices(tenantId: TenantId, customerId?: string): Promise<ReportInvoice[]> {
    const rows = await this.prisma.$queryRaw<{ id: string; code: string; customer_id: string; issue_date: Date; due_date: Date; total: string; paid: string }[]>`
      SELECT i.id, i.code, i.customer_id, i.issue_date, i.due_date, i.total::text,
             COALESCE(SUM(a.amount) FILTER (WHERE p.status = 'confirmed'), 0)::text AS paid
      FROM invoices i
      LEFT JOIN payment_allocations a ON a.tenant_id = i.tenant_id AND a.invoice_id = i.id
      LEFT JOIN customer_payments p ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
      WHERE i.tenant_id = ${tenantId.value}::uuid AND i.status = 'issued'
        AND (${customerId ?? null}::uuid IS NULL OR i.customer_id = ${customerId ?? null}::uuid)
      GROUP BY i.id
      ORDER BY i.code`;

    return rows.map((row) => ({ id: row.id, code: row.code, customerId: row.customer_id, issueDate: day(row.issue_date), dueDate: day(row.due_date), total: num(row.total), paid: num(row.paid) }));
  }

  async statementEntries(tenantId: TenantId, customerId: string): Promise<ReportStatementEntry[]> {
    const rows = await this.prisma.$queryRaw<{ date: Date; type: 'invoice' | 'payment'; code: string; amount: string }[]>`
      SELECT issue_date AS date, 'invoice' AS type, code, total::text AS amount
      FROM invoices WHERE tenant_id = ${tenantId.value}::uuid AND customer_id = ${customerId}::uuid AND status = 'issued'
      UNION ALL
      SELECT payment_date, 'payment', code, amount::text
      FROM customer_payments WHERE tenant_id = ${tenantId.value}::uuid AND customer_id = ${customerId}::uuid AND status = 'confirmed'`;

    return rows.map((row) => ({ date: day(row.date), type: row.type, code: row.code, amount: num(row.amount) }));
  }

  async salesTotal(tenantId: TenantId, period: ReportPeriod): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(total), 0)::text AS total FROM invoices
      WHERE tenant_id = ${tenantId.value}::uuid AND status = 'issued'
        AND issue_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date`;

    return num(row.total);
  }

  async purchasesTotal(tenantId: TenantId, period: ReportPeriod): Promise<number> {
    // Redondeado a centimos por linea, como se valoran los documentos.
    const [row] = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(ROUND(l.quantity * l.unit_cost, 2)), 0)::text AS total
      FROM goods_receipts r JOIN goods_receipt_lines l ON l.tenant_id = r.tenant_id AND l.receipt_id = r.id
      WHERE r.tenant_id = ${tenantId.value}::uuid AND r.status = 'confirmed'
        AND r.receipt_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date`;

    return num(row.total);
  }

  async collectedTotal(tenantId: TenantId, period: ReportPeriod): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(amount), 0)::text AS total FROM customer_payments
      WHERE tenant_id = ${tenantId.value}::uuid AND status = 'confirmed'
        AND payment_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date`;

    return num(row.total);
  }

  async salesByCustomer(tenantId: TenantId, period: ReportPeriod): Promise<ReportCustomerSales[]> {
    const rows = await this.prisma.$queryRaw<{ customer_id: string; invoices: bigint; subtotal: string; tax: string; total: string }[]>`
      SELECT customer_id, COUNT(*) AS invoices, SUM(subtotal)::text AS subtotal, SUM(tax)::text AS tax, SUM(total)::text AS total
      FROM invoices
      WHERE tenant_id = ${tenantId.value}::uuid AND status = 'issued'
        AND issue_date BETWEEN ${period.from.value}::date AND ${period.to.value}::date
      GROUP BY customer_id`;

    return rows.map((row) => ({ customerId: row.customer_id, invoices: Number(row.invoices), subtotal: num(row.subtotal), tax: num(row.tax), total: num(row.total) }));
  }

  async salesByItem(tenantId: TenantId, period: ReportPeriod): Promise<ReportItemSales[]> {
    const rows = await this.prisma.$queryRaw<{ item_id: string; sku: string; name: string; subtotal: string }[]>`
      SELECT l.item_id, it.sku, it.name, SUM(l.subtotal)::text AS subtotal
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
