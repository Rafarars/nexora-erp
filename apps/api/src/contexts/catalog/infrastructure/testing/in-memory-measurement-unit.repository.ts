import { ensureUniqueCode } from './unique-code.js';
import {
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
} from '../../domain/errors/duplicate.errors.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../../domain/measurement-unit/measurement-unit-name.vo.js';
import {
  MeasurementUnit,
  MeasurementUnitPrimitives,
} from '../../domain/measurement-unit/measurement-unit.entity.js';
import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { UnitAbbreviation } from '../../domain/measurement-unit/unit-abbreviation.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryMeasurementUnitRepository implements MeasurementUnitRepository {
  private readonly rows = new Map<string, MeasurementUnitPrimitives>();

  constructor(seed: MeasurementUnit[] = []) {
    seed.forEach((unit) => this.rows.set(unit.id.value, unit.toPrimitives()));
  }

  async save(unit: MeasurementUnit): Promise<void> {
    const row = unit.toPrimitives();
    ensureUniqueCode([...this.rows.values()], row);
    const others = [...this.rows.values()].filter(
      (other) => other.id !== row.id && other.tenantId === row.tenantId,
    );

    if (others.some((other) => other.name === row.name)) {
      throw new DuplicateMeasurementUnitNameError(row.name, row.tenantId);
    }

    if (others.some((other) => other.abbreviation === row.abbreviation)) {
      throw new DuplicateMeasurementUnitAbbreviationError(row.abbreviation, row.tenantId);
    }

    this.rows.set(row.id, row);
  }

  async find(tenantId: TenantId, id: MeasurementUnitId): Promise<MeasurementUnit | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? MeasurementUnit.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: MeasurementUnitName): Promise<MeasurementUnit | null> {
    return this.findWhere(tenantId, (row) => row.name === name.value);
  }

  async findByAbbreviation(tenantId: TenantId, abbreviation: UnitAbbreviation): Promise<MeasurementUnit | null> {
    return this.findWhere(tenantId, (row) => row.abbreviation === abbreviation.value);
  }

  async searchByIds(tenantId: TenantId, ids: MeasurementUnitId[]): Promise<MeasurementUnit[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.ofTenant(tenantId).filter((row) => wanted.has(row.id)).map((row) => MeasurementUnit.fromPrimitives(row));
  }

  async searchByTenant(tenantId: TenantId): Promise<MeasurementUnit[]> {
    return this.ofTenant(tenantId).map((row) => MeasurementUnit.fromPrimitives(row));
  }

  private ofTenant(tenantId: TenantId): MeasurementUnitPrimitives[] {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private findWhere(
    tenantId: TenantId,
    matches: (row: MeasurementUnitPrimitives) => boolean,
  ): MeasurementUnit | null {
    const row = this.ofTenant(tenantId).find(matches);

    return row ? MeasurementUnit.fromPrimitives(row) : null;
  }
}
