import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  CreditNoteSearchFilter,
  CustomerCreditNoteRepository,
} from '../../domain/credit-note/customer-credit-note.repository.js';
import {
  CreditNoteId,
  CustomerCreditNote,
} from '../../domain/credit-note/customer-credit-note.entity.js';
import { NoteCredit } from '../../domain/credit-note/note-credit.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, CREDIT_NOTE_INCLUDE, creditNoteFromRow, CreditNoteRow } from './receivables-rows.js';

import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { CreditNoteNotEditableError } from '../../domain/errors/receivables.errors.js';
import { queryAppliedAmountsByNotes, queryAppliedPaymentsSum } from './credit-note-applied-query.js';

@Injectable()
export class PrismaCustomerCreditNoteRepository implements CustomerCreditNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(note: CustomerCreditNote): Promise<void> {
    const { lines, ...p } = note.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.customerCreditNote.findFirst({
        where: { tenantId: p.tenantId, id: p.id },
        select: { status: true },
      });

      if (!exists) {
        await tx.customerCreditNote.create({
          data: {
            id: p.id,
            tenantId: p.tenantId,
            code: p.code,
            customerId: p.customerId,
            invoiceId: p.invoiceId,
            salesReturnId: p.salesReturnId,
            issuePaymentId: p.issuePaymentId,
            issueDate: asDate(p.issueDate),
            reason: p.reason,
            reasonDetail: p.reasonDetail,
            notes: p.notes,
            status: p.status,
            subtotal: p.subtotal,
            tax: p.tax,
            total: p.total,
            subtotalVes: p.subtotalVes,
            taxVes: p.taxVes,
            totalVes: p.totalVes,
            currency: p.currency,
            exchangeRate: p.exchangeRate,
            baseCurrency: p.baseCurrency,
            baseExchangeRate: p.baseExchangeRate,
            manualExchangeRate: p.manualExchangeRate,
            confirmedAt: p.confirmedAt,
            cancelledAt: p.cancelledAt,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          },
        });
      } else {
        const { count } = await tx.customerCreditNote.updateMany({
          where: {
            tenantId: p.tenantId,
            id: p.id,
            status: 'draft',
            updatedAt: note.version() ?? undefined,
          },
          data: {
            invoiceId: p.invoiceId,
            salesReturnId: p.salesReturnId,
            issuePaymentId: p.issuePaymentId,
            issueDate: asDate(p.issueDate),
            reason: p.reason,
            reasonDetail: p.reasonDetail,
            notes: p.notes,
            status: p.status,
            subtotal: p.subtotal,
            tax: p.tax,
            total: p.total,
            subtotalVes: p.subtotalVes,
            taxVes: p.taxVes,
            totalVes: p.totalVes,
            currency: p.currency,
            exchangeRate: p.exchangeRate,
            baseCurrency: p.baseCurrency,
            baseExchangeRate: p.baseExchangeRate,
            manualExchangeRate: p.manualExchangeRate,
            confirmedAt: p.confirmedAt,
            cancelledAt: p.cancelledAt,
            updatedAt: p.updatedAt,
          },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new CreditNoteNotEditableError(p.id, exists.status);
          throw new ConcurrentModificationError(p.id);
        }

        await tx.customerCreditNoteLine.deleteMany({
          where: { tenantId: p.tenantId, creditNoteId: p.id },
        });
      }

      await tx.customerCreditNoteLine.createMany({
        data: lines.map((l) => ({
          id: l.id,
          tenantId: p.tenantId,
          creditNoteId: p.id,
          lineNumber: l.lineNumber,
          itemId: l.itemId,
          itemSku: l.itemSku,
          itemName: l.itemName,
          concept: l.concept,
          unitId: l.unitId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          subtotal: l.subtotal,
          tax: l.tax,
          total: l.total,
        })),
      });
    });
  }

  async find(tenantId: TenantId, id: CreditNoteId): Promise<CustomerCreditNote | null> {
    const row = await this.prisma.customerCreditNote.findFirst({
      where: { tenantId: tenantId.value, id: id.value },
      include: CREDIT_NOTE_INCLUDE,
    });

    return row ? creditNoteFromRow(row as unknown as CreditNoteRow) : null;
  }

  async searchPage(
    tenantId: TenantId,
    filter: CreditNoteSearchFilter,
  ): Promise<{ notes: CustomerCreditNote[]; total: number }> {
    const where: any = {
      tenantId: tenantId.value,
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.invoiceId ? { invoiceId: filter.invoiceId } : {}),
      ...(filter.salesReturnId ? { salesReturnId: filter.salesReturnId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.from || filter.to
        ? {
            issueDate: {
              ...(filter.from ? { gte: asDate(filter.from) } : {}),
              ...(filter.to ? { lte: asDate(filter.to) } : {}),
            },
          }
        : {}),
      ...(filter.text
        ? {
            OR: [
              { code: { contains: filter.text, mode: 'insensitive' } },
              { customer: { name: { contains: filter.text, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.customerCreditNote.findMany({
        where,
        include: CREDIT_NOTE_INCLUDE,
        orderBy: [{ issueDate: 'desc' }, { code: 'desc' }],
        take: filter.limit ?? 20,
        skip: filter.offset ?? 0,
      }),
      this.prisma.customerCreditNote.count({ where }),
    ]);

    return {
      notes: rows.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow)),
      total,
    };
  }

  async creditedAmountByInvoice(tenantId: TenantId, invoiceId: string): Promise<number> {
    const result = await this.prisma.customerCreditNote.aggregate({
      where: {
        tenantId: tenantId.value,
        invoiceId,
        status: 'confirmed',
      },
      _sum: { total: true },
    });

    return result._sum.total ? result._sum.total.toNumber() : 0;
  }

  async creditedNotesByReturn(tenantId: TenantId, salesReturnId: string): Promise<CustomerCreditNote[]> {
    const rows = await this.prisma.customerCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        salesReturnId,
        status: 'confirmed',
      },
      include: CREDIT_NOTE_INCLUDE,
    });

    return rows.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow));
  }

  async findByIds(tenantId: TenantId, ids: CreditNoteId[]): Promise<CustomerCreditNote[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.customerCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        id: { in: ids.map((i) => i.value) },
      },
      include: CREDIT_NOTE_INCLUDE,
    });

    return rows.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow));
  }

  async appliedAmountsByNotes(
    tenantId: TenantId,
    noteIds: CreditNoteId[],
    excludePaymentId?: string | null,
  ): Promise<Map<string, number>> {
    return queryAppliedAmountsByNotes(
      this.prisma,
      tenantId.value,
      noteIds.map((n) => n.value),
      excludePaymentId,
    );
  }

  async appliedPaymentsSum(tenantId: TenantId, noteId: CreditNoteId, excludePaymentId?: string | null): Promise<number> {
    return queryAppliedPaymentsSum(this.prisma, tenantId.value, noteId.value, excludePaymentId);
  }

  async hasConfirmedPaymentsOtherThan(
    tenantId: TenantId,
    noteId: CreditNoteId,
    excludePaymentId: string | null,
  ): Promise<boolean> {
    const count = await this.prisma.customerPayment.count({
      where: {
        tenantId: tenantId.value,
        creditSourceId: noteId.value,
        status: 'confirmed',
        ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      },
    });

    return count > 0;
  }

  async findAvailableCreditsByCustomer(tenantId: TenantId, customerId: string): Promise<CustomerCreditNote[]> {
    const notes = await this.prisma.customerCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        customerId,
        status: 'confirmed',
      },
      include: CREDIT_NOTE_INCLUDE,
      orderBy: { issueDate: 'asc' },
    });

    const entities = notes.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow));
    const appliedMap = await this.appliedAmountsByNotes(tenantId, entities.map((e) => e.id));

    const result: CustomerCreditNote[] = [];
    for (const entity of entities) {
      const applied = appliedMap.get(entity.id.value) ?? 0;
      const available = NoteCredit.available(entity.total(), applied);

      if (available > 0) {
        result.push(entity);
      }
    }

    return result;
  }
}
