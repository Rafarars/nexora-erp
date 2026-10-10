import { JournalEntry, JournalEntryPrimitives } from '../../domain/journal/journal-entry.entity.js';
import {
  JournalEntryFilters,
  JournalEntryRepository,
} from '../../domain/journal/journal-entry.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryJournalEntryRepository implements JournalEntryRepository {
  private readonly entries = new Map<string, JournalEntryPrimitives>();

  async save(entry: JournalEntry): Promise<void> {
    const key = `${entry.tenantId.value}:${entry.id}`;
    this.entries.set(key, entry.toPrimitives());
  }

  async findById(tenantId: TenantId, id: string): Promise<JournalEntry | null> {
    const key = `${tenantId.value}:${id}`;
    const row = this.entries.get(key);
    return row ? JournalEntry.fromPrimitives(row) : null;
  }

  async findByCode(tenantId: TenantId, code: string): Promise<JournalEntry | null> {
    for (const row of this.entries.values()) {
      if (row.tenantId === tenantId.value && row.code === code) {
        return JournalEntry.fromPrimitives(row);
      }
    }
    return null;
  }

  async findByOrigin(
    tenantId: TenantId,
    originType: string,
    originId: string,
  ): Promise<JournalEntry | null> {
    for (const row of this.entries.values()) {
      if (
        row.tenantId === tenantId.value &&
        row.originType === originType &&
        row.originId === originId
      ) {
        return JournalEntry.fromPrimitives(row);
      }
    }
    return null;
  }

  async findByReversalOf(
    tenantId: TenantId,
    reversalOfId: string,
  ): Promise<JournalEntry | null> {
    for (const row of this.entries.values()) {
      if (row.tenantId === tenantId.value && row.reversalOfId === reversalOfId) {
        return JournalEntry.fromPrimitives(row);
      }
    }
    return null;
  }

  async search(
    tenantId: TenantId,
    filters?: JournalEntryFilters,
  ): Promise<{ entries: JournalEntry[]; total: number }> {
    let rows = Array.from(this.entries.values()).filter(
      (r) => r.tenantId === tenantId.value,
    );

    if (filters?.originType) {
      rows = rows.filter((r) => r.originType === filters.originType);
    }
    if (filters?.originId) {
      rows = rows.filter((r) => r.originId === filters.originId);
    }
    if (filters?.from) {
      const fromTime = filters.from.getTime();
      rows = rows.filter((r) => new Date(r.entryDate).getTime() >= fromTime);
    }
    if (filters?.to) {
      const toTime = filters.to.getTime();
      rows = rows.filter((r) => new Date(r.entryDate).getTime() <= toTime);
    }
    if (filters?.accountId) {
      rows = rows.filter((r) => r.lines.some((l) => l.accountId === filters.accountId));
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.lines.some((l) => l.label.toLowerCase().includes(q)),
      );
    }

    // Orden cronológico descendente por fecha y código
    rows.sort((a, b) => {
      const dateDiff = new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.code.localeCompare(a.code);
    });

    const total = rows.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? rows.length;
    const paginated = rows.slice(offset, offset + limit);

    return {
      entries: paginated.map((r) => JournalEntry.fromPrimitives(r)),
      total,
    };
  }
}
