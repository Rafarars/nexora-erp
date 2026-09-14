import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { InvoiceStatus } from '../../domain/invoice/invoice.entity.js';
import { InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface InvoiceResponse {
  id: string;
  code: string;
  customer: { id: string; name: string };
  dispatch: { id: string; code: string };
  order: { id: string; code: string };
  issueDate: string;
  dueDate: string;
  notes: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  lines: {
    lineNumber: number;
    itemId: string;
    sku: string;
    itemName: string;
    unitAbbreviation: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number;
    tax: number;
  }[];
}

export class InvoiceSearcher {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly dispatches: DispatchRepository,
    private readonly orders: SalesOrderRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
  ) {}

  async run(request: { tenantId: string }): Promise<{ invoices: InvoiceResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const invoices = await this.invoices.searchByTenant(tenantId);
    const rows = invoices.map((invoice) => invoice.toPrimitives());

    const [dispatches, orders, customers, items] = await Promise.all([
      this.dispatches.searchByTenant(tenantId),
      this.orders.searchByTenant(tenantId),
      this.customers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Map(invoices.flatMap((i) => i.lineItems()).map((l) => [l.itemId.value, l.itemId])).values()]),
    ]);

    return {
      invoices: rows
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((row) => ({
          id: row.id,
          code: row.code,
          customer: { id: row.customerId, name: customers.find((c) => c.id.value === row.customerId)?.name() ?? '' },
          dispatch: { id: row.dispatchId, code: dispatches.find((d) => d.id.value === row.dispatchId)?.code ?? '' },
          order: { id: row.orderId, code: orders.find((o) => o.id.value === row.orderId)?.code ?? '' },
          issueDate: row.issueDate,
          dueDate: row.dueDate,
          notes: row.notes,
          status: row.status,
          subtotal: row.subtotal,
          tax: row.tax,
          total: row.total,
          lines: row.lines.map((line) => {
            const item = items.find((candidate) => candidate.id === line.itemId);

            return {
              lineNumber: line.lineNumber,
              itemId: line.itemId,
              sku: item?.sku ?? '',
              itemName: item?.name ?? '',
              unitAbbreviation: item?.units.find((unit) => unit.unitId === line.unitId)?.abbreviation ?? '',
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              subtotal: line.subtotal,
              tax: line.tax,
            };
          }),
        })),
    };
  }
}
