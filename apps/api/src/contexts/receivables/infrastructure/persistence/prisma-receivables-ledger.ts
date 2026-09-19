import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer, ReceivableCustomerFilter, ReceivableInvoiceFilter, ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, customerFromRow, invoiceFromRow, invoiceSelect } from './receivables-rows.js';

const CUSTOMER_SELECT = { id: true, code: true, name: true, paymentTermDays: true, creditLimit: true, isActive: true } as const;

const like = (text: string) => ({ contains: text, mode: 'insensitive' as const });

// Lee clientes y facturas de las tablas de ventas, como el inventario lee las del catalogo.
@Injectable()
export class PrismaReceivablesLedger implements ReceivablesLedger {
  constructor(private readonly prisma: PrismaService) {}

  async customers(tenantId: TenantId, filter: ReceivableCustomerFilter = {}): Promise<ReceivableCustomer[]> {
    const text = filter.text ?? null;
    const rows = await this.prisma.customer.findMany({
      where: { tenantId: tenantId.value, ...(text ? { OR: [{ code: like(text) }, { name: like(text) }] } : {}) },
      select: CUSTOMER_SELECT,
      // El desempate por codigo evita que dos homonimos se turnen entre paginas.
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });

    return rows.map(customerFromRow);
  }

  async customer(tenantId: TenantId, customerId: string): Promise<ReceivableCustomer | null> {
    const row = await this.prisma.customer.findFirst({ where: { tenantId: tenantId.value, id: customerId }, select: CUSTOMER_SELECT });

    return row ? customerFromRow(row) : null;
  }

  async invoices(tenantId: TenantId, filter: ReceivableInvoiceFilter = {}): Promise<ReceivableInvoice[]> {
    const text = filter.text ?? null;
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: tenantId.value,
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(filter.ids ? { id: { in: filter.ids } } : {}),
        ...(filter.onlyIssued ? { status: 'issued' as const } : {}),
        ...(filter.from || filter.to ? { dueDate: { ...(filter.from ? { gte: asDate(filter.from) } : {}), ...(filter.to ? { lte: asDate(filter.to) } : {}) } } : {}),
        ...(text ? { OR: [{ code: like(text) }, { customer: { name: like(text) } }] } : {}),
      },
      select: invoiceSelect(),
      orderBy: { code: 'desc' },
    });

    return rows.map(invoiceFromRow);
  }
}
