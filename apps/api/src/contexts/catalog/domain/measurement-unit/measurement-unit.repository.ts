import { TenantId } from '../shared/tenant-id.vo.js';
import { MeasurementUnitId } from './measurement-unit-id.vo.js';
import { MeasurementUnitName } from './measurement-unit-name.vo.js';
import { MeasurementUnit } from './measurement-unit.entity.js';
import { UnitAbbreviation } from './unit-abbreviation.vo.js';

export const MEASUREMENT_UNIT_REPOSITORY = Symbol('MeasurementUnitRepository');

// `save` lanza el error de duplicado que corresponda si la base rechaza el nombre o la
// abreviatura.
export interface MeasurementUnitRepository {
  save(unit: MeasurementUnit): Promise<void>;
  find(tenantId: TenantId, id: MeasurementUnitId): Promise<MeasurementUnit | null>;
  findByName(tenantId: TenantId, name: MeasurementUnitName): Promise<MeasurementUnit | null>;
  findByAbbreviation(tenantId: TenantId, abbreviation: UnitAbbreviation): Promise<MeasurementUnit | null>;
  searchByIds(tenantId: TenantId, ids: MeasurementUnitId[]): Promise<MeasurementUnit[]>;
  searchByTenant(tenantId: TenantId): Promise<MeasurementUnit[]>;
}
