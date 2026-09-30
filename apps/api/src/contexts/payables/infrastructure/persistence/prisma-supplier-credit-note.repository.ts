import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  SupplierCreditNoteSearchFilter,
  SupplierCreditNoteRepository,
} from '../../domain/credit-note/supplier-credit-note.repository.js';
import {
  SupplierCreditNoteId,
  SupplierCreditNote,
} from '../../domain/credit-note/supplier-credit-note.entity.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { PaymentId } from '../../domain/payment/supplier-payment.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, CREDIT_NOTE_INCLUDE, creditNoteFromRow, CreditNoteRow } from './payables-rows.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { CreditNoteNotEditableError } from '../../domain/errors/payables.errors.js';
import { queryAppliedAmountsByNotes, queryAppliedPaymentsSum } from './credit-note-applied-query.js';

@Injectable()
export class PrismaSupplierCreditNoteRepository implements SupplierCreditNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(note: SupplierCreditNote): Promise<void> {
    const { lines, ...p } = note.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.supplierCreditNote.findFirst({
        where: { tenantId: p.tenantId, id: p.id },
        select: { status: true },
      });

      if (!exists) {
        await tx.supplierCreditNote.create({
          data: {
            id: p.id,
            tenantId: p.tenantId,
            code: p.code,
            supplierId: p.supplierId,
            invoiceId: p.invoiceId,
            purchaseReturnId: p.purchaseReturnId,
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
        const { count } = await tx.supplierCreditNote.updateMany({
          where: {
            tenantId: p.tenantId,
            id: p.id,
            status: 'draft',
            updatedAt: note.version() ?? undefined,
          },
          data: {
            invoiceId: p.invoiceId,
            purchaseReturnId: p.purchaseReturnId,
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

        await tx.supplierCreditNoteLine.deleteMany({
          where: { tenantId: p.tenantId, creditNoteId: p.id },
        });
      }

      await tx.supplierCreditNoteLine.createMany({
        data: lines.map((l) => ({
          id: l.id,
          tenantId: p.tenantId,
          creditNoteId: p.id,
          lineNumber: l.lineNumber,
          invoiceLineId: l.invoiceLineId ?? null,
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

  async find(tenantId: TenantId, id: SupplierCreditNoteId): Promise<SupplierCreditNote | null> {
    const row = await this.prisma.supplierCreditNote.findFirst({
      where: { tenantId: tenantId.value, id: id.value },
      include: CREDIT_NOTE_INCLUDE,
    });

    return row ? creditNoteFromRow(row as unknown as CreditNoteRow) : null;
  }

  async findByIssuePayment(tenantId: TenantId, paymentId: PaymentId): Promise<SupplierCreditNote | null> {
    const row = await this.prisma.supplierCreditNote.findFirst({
      where: { tenantId: tenantId.value, issuePaymentId: paymentId.value },
      include: CREDIT_NOTE_INCLUDE,
    });

    return row ? creditNoteFromRow(row as unknown as CreditNoteRow) : null;
  }

  async findByIssuePayments(tenantId: TenantId, paymentIds: PaymentId[]): Promise<SupplierCreditNote[]> {
    if (paymentIds.length === 0) return [];
    const rows = await this.prisma.supplierCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        issuePaymentId: { in: paymentIds.map((p) => p.value) },
      },
      include: CREDIT_NOTE_INCLUDE,
    });

    return rows.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow));
  }

  async searchPage(
    tenantId: TenantId,
    filter: SupplierCreditNoteSearchFilter,
  ): Promise<{ notes: SupplierCreditNote[]; total: number }> {
    const where: any = {
      tenantId: tenantId.value,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.invoiceId ? { invoiceId: filter.invoiceId } : {}),
      ...(filter.purchaseReturnId ? { purchaseReturnId: filter.purchaseReturnId } : {}),
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
              { supplier: { name: { contains: filter.text, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.supplierCreditNote.findMany({
        where,
        include: CREDIT_NOTE_INCLUDE,
        orderBy: [{ issueDate: 'desc' }, { code: 'desc' }],
        take: filter.limit ?? 20,
        skip: filter.offset ?? 0,
      }),
      this.prisma.supplierCreditNote.count({ where }),
    ]);

    return {
      notes: rows.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow)),
      total,
    };
  }

  async creditedAmountByInvoice(tenantId: TenantId, invoiceId: string): Promise<number> {
    const result = await this.prisma.supplierCreditNote.aggregate({
      where: {
        tenantId: tenantId.value,
        invoiceId,
        status: 'confirmed',
      },
      _sum: { total: true },
    });

    return result._sum.total ? result._sum.total.toNumber() : 0;
  }

  async creditedAmountByInvoiceLines(
    tenantId: TenantId,
    invoiceLineIds: string[],
    excludeNoteId?: SupplierCreditNoteId,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (invoiceLineIds.length === 0) return map;

    const rows = await this.prisma.supplierCreditNoteLine.groupBy({
      by: ['invoiceLineId'],
      where: {
        tenantId: tenantId.value,
        invoiceLineId: { in: invoiceLineIds },
        creditNote: {
          tenantId: tenantId.value,
          status: 'confirmed',
          ...(excludeNoteId ? { id: { not: excludeNoteId.value } } : {}),
        },
      },
      _sum: { subtotal: true },
    });

    for (const r of rows) {
      if (r.invoiceLineId) {
        map.set(r.invoiceLineId, r._sum.subtotal ? r._sum.subtotal.toNumber() : 0);
      }
    }
    return map;
  }

  async creditedNotesByReturn(tenantId: TenantId, purchaseReturnId: string): Promise<SupplierCreditNote[]> {
    const rows = await this.prisma.supplierCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        purchaseReturnId,
        status: 'confirmed',
      },
      include: CREDIT_NOTE_INCLUDE,
    });

    return rows.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow));
  }

  async findByIds(tenantId: TenantId, ids: SupplierCreditNoteId[]): Promise<SupplierCreditNote[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.supplierCreditNote.findMany({
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
    noteIds: SupplierCreditNoteId[],
    excludePaymentId?: string | null,
  ): Promise<Map<string, number>> {
    return queryAppliedAmountsByNotes(
      this.prisma,
      tenantId.value,
      noteIds.map((n) => n.value),
      excludePaymentId,
    );
  }

  async appliedPaymentsSum(tenantId: TenantId, noteId: SupplierCreditNoteId, excludePaymentId?: string | null): Promise<number> {
    return queryAppliedPaymentsSum(this.prisma, tenantId.value, noteId.value, excludePaymentId);
  }

  async hasConfirmedPaymentsOtherThan(
    tenantId: TenantId,
    noteId: SupplierCreditNoteId,
    excludePaymentId: string | null,
  ): Promise<boolean> {
    const count = await this.prisma.supplierPayment.count({
      where: {
        tenantId: tenantId.value,
        creditSourceId: noteId.value,
        status: 'confirmed',
        ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      },
    });

    return count > 0;
  }

  async findAvailableCreditsBySupplier(tenantId: TenantId, supplierId: string): Promise<SupplierCreditNote[]> {
    const notes = await this.prisma.supplierCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        supplierId,
        status: 'confirmed',
      },
      include: CREDIT_NOTE_INCLUDE,
      orderBy: { issueDate: 'asc' },
    });

    const entities = notes.map((r) => creditNoteFromRow(r as unknown as CreditNoteRow));
    const appliedMap = await this.appliedAmountsByNotes(tenantId, entities.map((e) => e.id));

    const result: SupplierCreditNote[] = [];
    for (const entity of entities) {
      const applied = appliedMap.get(entity.id.value) ?? 0;
      const available = PayableCreditQuota.available(entity.total(), applied);

      if (available > 0) {
        result.push(entity);
      }
    }

    return result;
  }

  async confirmedCreditedReturnIds(tenantId: TenantId): Promise<Set<string>> {
    const rows = await this.prisma.supplierCreditNote.findMany({
      where: {
        tenantId: tenantId.value,
        purchaseReturnId: { not: null },
        status: 'confirmed',
      },
      select: { purchaseReturnId: true },
    });

    return new Set(rows.map((r) => r.purchaseReturnId!).filter(Boolean));
  }
}
