import { ReportCompany } from '../../domain/read-model/reporting-read-model.js';
import { AGING_BUCKETS, AgingBucket } from '../../domain/aging/aging.js';
import { ReportDocument } from '../../domain/document/report-document.js';
import { formatAmount } from '../../domain/document/report-format.js';
import { CustomerStatementResponse } from '../customer-statement/customer-statement-report.js';
import { InventoryValuationResponse } from '../inventory-valuation/inventory-valuation-report.js';
import { ReceivablesAgingResponse } from '../receivables-aging/receivables-aging-report.js';
import { SalesByCustomerResponse } from '../sales-by-customer/sales-by-customer-report.js';

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: 'Por vencer',
  days1To30: '1 a 30 días',
  days31To60: '31 a 60 días',
  days61To90: '61 a 90 días',
  over90: 'Más de 90 días',
};

// Cada reporte convertido en un documento: lo mismo que ve la pantalla, con titulo y filtros. Aqui
// se decide el contenido; el PDF y el Excel solo lo escriben.
// La linea de quien emite: su razon social y, si la tiene, su RIF.
export function companyHeader(company: ReportCompany): string {
  return company.fiscalId ? `${company.name} · RIF ${company.fiscalId}` : company.name;
}

// Los importes van todos en la moneda de la empresa: cada documento llega convertido con sus tasas.
const amountsIn = (currency: string) => `Importes en ${currency}`;

export function receivablesAgingDocument(report: ReceivablesAgingResponse, company: string): ReportDocument {
  const buckets = AGING_BUCKETS.map((bucket) => ({ key: bucket, label: BUCKET_LABELS[bucket], kind: 'amount' as const }));

  return {
    fileName: `antiguedad-de-saldos-${report.asOf}`,
    title: 'Antigüedad de saldos por cobrar',
    subtitle: [company, `Al ${report.asOf} · ${amountsIn(report.currency)}`],
    decimals: report.decimals,
    columns: [{ key: 'code', label: 'Código', kind: 'text' }, { key: 'customer', label: 'Cliente', kind: 'text' }, ...buckets, { key: 'total', label: 'Saldo', kind: 'amount' }],
    rows: report.customers.map((row) => ({ code: row.customer.code, customer: row.customer.name, ...row.aging })),
    totals: { code: 'Total', customer: null, ...report.totals },
  };
}

export function customerStatementDocument(report: CustomerStatementResponse, company: string): ReportDocument {
  const { customer } = report;
  const amount = (value: number) => formatAmount(value, report.decimals);
  const credit = customer.paymentTermDays === 0 ? 'Contado' : `Plazo ${customer.paymentTermDays} días · Límite ${customer.creditLimit === null ? 'sin límite' : amount(customer.creditLimit)}`;

  return {
    fileName: `estado-de-cuenta-${customer.code}-${report.asOf}`,
    title: `Estado de cuenta — ${customer.name}`,
    subtitle: [company, [customer.code, customer.fiscalId].filter(Boolean).join(' · '), credit, `Al ${report.asOf} · Saldo ${amount(report.balance)} · Vencido ${amount(report.overdue)} · ${amountsIn(report.currency)}`],
    decimals: report.decimals,
    columns: [
      { key: 'date', label: 'Fecha', kind: 'date' },
      { key: 'document', label: 'Documento', kind: 'text' },
      { key: 'debit', label: 'Cargo', kind: 'amount' },
      { key: 'credit', label: 'Abono', kind: 'amount' },
      { key: 'balance', label: 'Saldo', kind: 'amount' },
    ],
    rows: report.movements.map((row) => ({
      date: row.date,
      document: `${row.type === 'invoice' ? 'Factura' : 'Cobro'} ${row.code}`,
      debit: row.debit || null,
      credit: row.credit || null,
      balance: row.balance,
    })),
    totals: { date: 'Saldo', document: null, debit: null, credit: null, balance: report.balance },
  };
}

export function salesByCustomerDocument(report: SalesByCustomerResponse, company: string): ReportDocument {
  return {
    fileName: `ventas-por-cliente-${report.period.from}-a-${report.period.to}`,
    title: 'Ventas por cliente',
    subtitle: [company, `Del ${report.period.from} al ${report.period.to} · Facturas emitidas · ${amountsIn(report.currency)}`],
    decimals: report.decimals,
    columns: [
      { key: 'code', label: 'Código', kind: 'text' },
      { key: 'customer', label: 'Cliente', kind: 'text' },
      { key: 'invoices', label: 'Facturas', kind: 'integer' },
      { key: 'subtotal', label: 'Subtotal', kind: 'amount' },
      { key: 'tax', label: 'Impuesto', kind: 'amount' },
      { key: 'total', label: 'Total', kind: 'amount' },
    ],
    rows: report.customers.map((row) => ({ code: row.customer.code, customer: row.customer.name, invoices: row.invoices, subtotal: row.subtotal, tax: row.tax, total: row.total })),
    totals: { code: 'Total', customer: null, ...report.totals },
  };
}

export function inventoryValuationDocument(report: InventoryValuationResponse, company: string, asOf: string): ReportDocument {
  return {
    fileName: `valuacion-de-inventario-${report.warehouseName ? `${report.warehouseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-` : ''}${asOf}`,
    title: 'Valuación del inventario',
    subtitle: [company, report.warehouseName ? `Bodega ${report.warehouseName}` : 'Todas las bodegas', `Existencia al costo promedio · ${amountsIn(report.currency)}`],
    decimals: report.decimals,
    columns: [
      { key: 'warehouse', label: 'Bodega', kind: 'text' },
      { key: 'sku', label: 'SKU', kind: 'text' },
      { key: 'item', label: 'Artículo', kind: 'text' },
      { key: 'unit', label: 'Unidad', kind: 'text' },
      { key: 'quantity', label: 'Existencia', kind: 'quantity' },
      { key: 'averageCost', label: 'Costo promedio', kind: 'cost' },
      { key: 'value', label: 'Valor', kind: 'amount' },
    ],
    rows: report.rows.map((row) => ({ warehouse: row.warehouse.name, sku: row.item.sku, item: row.item.name, unit: row.baseUnit, quantity: row.quantity, averageCost: row.averageCost, value: row.value })),
    totals: { warehouse: 'Total', sku: null, item: null, unit: null, quantity: null, averageCost: null, value: report.totalValue },
  };
}
