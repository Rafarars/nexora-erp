import { ensureUniqueCode } from './unique-code.js';
import { DuplicateTaxNameError } from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TaxName } from '../../domain/tax/tax-name.vo.js';
import { Tax, TaxPrimitives } from '../../domain/tax/tax.entity.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';

export class InMemoryTaxRepository implements TaxRepository {
  private readonly rows = new Map<string, TaxPrimitives>();

  constructor(seed: Tax[] = []) {
    seed.forEach((tax) => this.rows.set(tax.id.value, tax.toPrimitives()));
  }

  async save(tax: Tax): Promise<void> {
    const row = tax.toPrimitives();
    ensureUniqueCode([...this.rows.values()], row);
    const clash = [...this.rows.values()].find(
      (other) => other.id !== row.id && other.tenantId === row.tenantId && other.name === row.name,
    );

    if (clash) throw new DuplicateTaxNameError(row.name, row.tenantId);

    this.rows.set(row.id, row);
  }

  async find(tenantId: TenantId, id: TaxId): Promise<Tax | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? Tax.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: TaxName): Promise<Tax | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.tenantId === tenantId.value && candidate.name === name.value,
    );

    return row ? Tax.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Tax[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((row) => Tax.fromPrimitives(row));
  }
}
