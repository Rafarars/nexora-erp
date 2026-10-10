import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { JournalEntryLine } from '../../domain/journal/journal-entry-line.entity.js';
import { JournalEntry } from '../../domain/journal/journal-entry.entity.js';
import {
  JournalEntryFilters,
  JournalEntryRepository,
} from '../../domain/journal/journal-entry.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

type JournalEntryWithLines = Prisma.JournalEntryGetPayload<{
  include: { lines: true };
}>;

@Injectable()
export class PrismaJournalEntryRepository implements JournalEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(entry: JournalEntry): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          tenantId: entry.tenantId.value,
          code: entry.code,
          entryDate: entry.entryDate,
          originType: entry.originType,
          originId: entry.originId,
          description: entry.description,
          currency: entry.currency,
          reversalOfId: entry.reversalOfId,
        },
        update: {
          code: entry.code,
          entryDate: entry.entryDate,
          originType: entry.originType,
          originId: entry.originId,
          description: entry.description,
          currency: entry.currency,
          reversalOfId: entry.reversalOfId,
        },
      });

      await tx.journalEntryLine.deleteMany({
        where: { entryId: entry.id, tenantId: entry.tenantId.value },
      });

      if (entry.lines.length > 0) {
        await tx.journalEntryLine.createMany({
          data: entry.lines.map((l) => ({
            id: l.id,
            tenantId: entry.tenantId.value,
            entryId: entry.id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            label: l.label,
          })),
        });
      }
    });
  }

  async findById(tenantId: TenantId, id: string): Promise<JournalEntry | null> {
    const row = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: tenantId.value },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(tenantId: TenantId, code: string): Promise<JournalEntry | null> {
    const row = await this.prisma.journalEntry.findFirst({
      where: { code, tenantId: tenantId.value },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByOrigin(
    tenantId: TenantId,
    originType: string,
    originId: string,
  ): Promise<JournalEntry | null> {
    const row = await this.prisma.journalEntry.findFirst({
      where: { tenantId: tenantId.value, originType, originId },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByReversalOf(
    tenantId: TenantId,
    reversalOfId: string,
  ): Promise<JournalEntry | null> {
    const row = await this.prisma.journalEntry.findFirst({
      where: { tenantId: tenantId.value, reversalOfId },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async search(
    tenantId: TenantId,
    filters?: JournalEntryFilters,
  ): Promise<{ entries: JournalEntry[]; total: number }> {
    const where: Prisma.JournalEntryWhereInput = {
      tenantId: tenantId.value,
    };

    if (filters?.originType) {
      where.originType = filters.originType;
    }
    if (filters?.originId) {
      where.originId = filters.originId;
    }
    if (filters?.from || filters?.to) {
      where.entryDate = {};
      if (filters?.from) where.entryDate.gte = filters.from;
      if (filters?.to) where.entryDate.lte = filters.to;
    }
    if (filters?.accountId) {
      where.lines = {
        some: { accountId: filters.accountId },
      };
    }
    if (filters?.query) {
      where.OR = [
        { code: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: [{ entryDate: 'desc' }, { code: 'desc' }],
        skip: filters?.offset,
        take: filters?.limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      entries: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  private toDomain(row: JournalEntryWithLines): JournalEntry {
    const lines = row.lines.map((l: JournalEntryWithLines['lines'][number]) =>
      JournalEntryLine.fromPrimitives({
        id: l.id,
        accountId: l.accountId,
        debit: Number(l.debit),
        credit: Number(l.credit),
        label: l.label,
      }),
    );

    return JournalEntry.create({
      id: row.id,
      tenantId: TenantId.of(row.tenantId),
      code: row.code,
      entryDate: row.entryDate,
      originType: row.originType,
      originId: row.originId,
      description: row.description,
      currency: row.currency,
      reversalOfId: row.reversalOfId,
      lines,
    });
  }
}
