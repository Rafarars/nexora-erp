import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
} from '../../domain/errors/duplicate.errors.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../../domain/measurement-unit/measurement-unit-name.vo.js';
import { MeasurementUnit } from '../../domain/measurement-unit/measurement-unit.entity.js';
import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { UnitAbbreviation } from '../../domain/measurement-unit/unit-abbreviation.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { violates } from './unique-violation.js';

@Injectable()
export class PrismaMeasurementUnitRepository implements MeasurementUnitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(unit: MeasurementUnit): Promise<void> {
    const { id, tenantId, code, name, abbreviation, isActive, createdAt, updatedAt } = unit.toPrimitives();

    try {
      await this.prisma.measurementUnit.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: { id, tenantId, code, name, abbreviation, isActive, createdAt, updatedAt },
        update: { name, abbreviation, isActive, updatedAt },
      });
    } catch (error) {
      if (violates(error, 'abbreviation')) throw new DuplicateMeasurementUnitAbbreviationError(abbreviation, tenantId);
      if (violates(error, 'name')) throw new DuplicateMeasurementUnitNameError(name, tenantId);
      throw error;
    }
  }

  async find(tenantId: TenantId, id: MeasurementUnitId): Promise<MeasurementUnit | null> {
    const row = await this.prisma.measurementUnit.findFirst({ where: { id: id.value, tenantId: tenantId.value } });

    return row ? MeasurementUnit.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: MeasurementUnitName): Promise<MeasurementUnit | null> {
    const row = await this.prisma.measurementUnit.findFirst({ where: { tenantId: tenantId.value, name: name.value } });

    return row ? MeasurementUnit.fromPrimitives(row) : null;
  }

  async findByAbbreviation(tenantId: TenantId, abbreviation: UnitAbbreviation): Promise<MeasurementUnit | null> {
    const row = await this.prisma.measurementUnit.findFirst({
      where: { tenantId: tenantId.value, abbreviation: abbreviation.value },
    });

    return row ? MeasurementUnit.fromPrimitives(row) : null;
  }

  async searchByIds(tenantId: TenantId, ids: MeasurementUnitId[]): Promise<MeasurementUnit[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.measurementUnit.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => MeasurementUnit.fromPrimitives(row));
  }

  async searchByTenant(tenantId: TenantId): Promise<MeasurementUnit[]> {
    const rows = await this.prisma.measurementUnit.findMany({
      where: { tenantId: tenantId.value },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => MeasurementUnit.fromPrimitives(row));
  }
}
