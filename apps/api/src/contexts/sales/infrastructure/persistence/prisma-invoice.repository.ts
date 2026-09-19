import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { Invoice, InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoiceCriteria, InvoicePage, InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
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

  async searchPage(tenantId: TenantId, criteria: InvoiceCriteria): Promise<InvoicePage> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.customerId ? { customerId: criteria.customerId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.from || criteria.to
        ? {
            issueDate: {
              ...(criteria.from ? { gte: new Date(`${criteria.from}T00:00:00.000Z`) } : {}),
              ...(criteria.to ? { lte: new Date(`${criteria.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' as const } },
              { order: { code: { contains: text, mode: 'insensitive' as const } } },
              { customer: { name: { contains: text, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: { lines: true }, orderBy: { code: 'desc' }, take: criteria.limit, skip: criteria.offset }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices: rows.map(invoiceFromRow), total };
  }

  async issuedForDispatch(tenantId: TenantId, dispatchId: DispatchId): Promise<boolean> {
    const row = await this.prisma.invoice.findFirst({ where: { tenantId: tenantId.value, dispatchId: dispatchId.value, status: 'issued' }, select: { id: true } });

    return row !== null;
  }
}
