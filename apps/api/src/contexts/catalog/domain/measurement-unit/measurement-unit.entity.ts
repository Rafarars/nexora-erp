import { CatalogCode, CodePrefix } from '../shared/catalog-code.vo.js';
import { CatalogRecord, CatalogRecordPrimitives } from '../shared/catalog-record.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { MeasurementUnitId } from './measurement-unit-id.vo.js';
import { MeasurementUnitName } from './measurement-unit-name.vo.js';
import { UnitAbbreviation } from './unit-abbreviation.vo.js';

export interface MeasurementUnitPrimitives extends CatalogRecordPrimitives {
  name: string;
  abbreviation: string;
  // Media pieza no significa nada; medio kilo si. Lo decide la unidad, no el articulo.
  mustBeWhole: boolean;
}

// Sin factor de conversion: cuantas unidades trae una caja depende del articulo, asi
// que la equivalencia se declara en cada uno.
export class MeasurementUnit extends CatalogRecord<MeasurementUnitId> {
  static readonly CODE_PREFIX: CodePrefix = 'UOM';

  private constructor(
    id: MeasurementUnitId,
    tenantId: TenantId,
    code: CatalogCode,
    private name: MeasurementUnitName,
    private abbreviation: UnitAbbreviation,
    private wholeOnly: boolean,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, tenantId, code, active, createdAt, updatedAt);
  }

  static create(
    id: MeasurementUnitId,
    tenantId: TenantId,
    code: CatalogCode,
    name: MeasurementUnitName,
    abbreviation: UnitAbbreviation,
    mustBeWhole: boolean,
    now: Date,
  ): MeasurementUnit {
    return new MeasurementUnit(id, tenantId, code, name, abbreviation, mustBeWhole, true, now, now);
  }

  static fromPrimitives(row: MeasurementUnitPrimitives): MeasurementUnit {
    return new MeasurementUnit(
      MeasurementUnitId.of(row.id),
      TenantId.of(row.tenantId),
      CatalogCode.of(row.code),
      MeasurementUnitName.of(row.name),
      UnitAbbreviation.of(row.abbreviation),
      row.mustBeWhole,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): MeasurementUnitPrimitives {
    return {
      ...this.recordPrimitives(),
      name: this.name.value,
      abbreviation: this.abbreviation.value,
      mustBeWhole: this.wholeOnly,
    };
  }

  update(name: MeasurementUnitName, abbreviation: UnitAbbreviation, mustBeWhole: boolean, now: Date): void {
    this.name = name;
    this.abbreviation = abbreviation;
    this.wholeOnly = mustBeWhole;
    this.touch(now);
  }
}
