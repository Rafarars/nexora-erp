import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer, ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { customerFromRow, invoiceFromRow, invoiceSelect } from './receivables-rows.js';

const CUSTOMER_SELECT = { id: true, code: true, name: true, paymentTermDays: true, creditLimit: true, isActive: true } as const;

// Lee clientes y facturas de las tablas de ventas, como el inventario lee las del catalogo.
@Injectable()
export class PrismaReceivablesLedger implements ReceivablesLedger {
  constructor(private readonly prisma: PrismaService) {}

  async customers(tenantId: TenantId): Promise<ReceivableCustomer[]> {
    const rows = await this.prisma.customer.findMany({ where: { tenantId: tenantId.value }, select: CUSTOMER_SELECT, orderBy: { name: 'asc' } });

    return rows.map(customerFromRow);
  }

  async customer(tenantId: TenantId, customerId: string): Promise<ReceivableCustomer | null> {
    const row = await this.prisma.customer.findFirst({ where: { tenantId: tenantId.value, id: customerId }, select: CUSTOMER_SELECT });

    return row ? customerFromRow(row) : null;
  }

  async invoices(tenantId: TenantId, filter: { customerId?: string; ids?: string[] } = {}): Promise<ReceivableInvoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { tenantId: tenantId.value, ...(filter.customerId ? { customerId: filter.customerId } : {}), ...(filter.ids ? { id: { in: filter.ids } } : {}) },
      select: invoiceSelect(),
      orderBy: { code: 'desc' },
    });

    return rows.map(invoiceFromRow);
  }
}
