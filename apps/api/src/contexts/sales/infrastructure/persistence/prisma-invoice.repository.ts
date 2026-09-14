import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { Invoice, InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { invoiceFromRow } from './sales-rows.js';

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: TenantId, id: InvoiceId): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: { lines: true } });

    return row ? invoiceFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({ where: { tenantId: tenantId.value }, include: { lines: true }, orderBy: { code: 'desc' } });

    return rows.map(invoiceFromRow);
  }

  async issuedForDispatch(tenantId: TenantId, dispatchId: DispatchId): Promise<boolean> {
    const row = await this.prisma.invoice.findFirst({ where: { tenantId: tenantId.value, dispatchId: dispatchId.value, status: 'issued' }, select: { id: true } });

    return row !== null;
  }
}
