import { CatalogCode, CodePrefix } from '../shared/catalog-code.vo.js';
import { CatalogRecord, CatalogRecordPrimitives } from '../shared/catalog-record.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from './tax-id.vo.js';
import { TaxName } from './tax-name.vo.js';
import { TaxRate } from './tax-rate.vo.js';

export interface TaxPrimitives extends CatalogRecordPrimitives {
  name: string;
  rate: number;
}

// Cambiar el porcentaje es legitimo: los documentos copiaran el vigente al confirmarse,
// asi que lo ya emitido no se recalcula.
export class Tax extends CatalogRecord<TaxId> {
  static readonly CODE_PREFIX: CodePrefix = 'IMP';

  private constructor(
    id: TaxId,
    tenantId: TenantId,
    code: CatalogCode,
    private name: TaxName,
    private rate: TaxRate,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, tenantId, code, active, createdAt, updatedAt);
  }

  static create(id: TaxId, tenantId: TenantId, code: CatalogCode, name: TaxName, rate: TaxRate, now: Date): Tax {
    return new Tax(id, tenantId, code, name, rate, true, now, now);
  }

  static fromPrimitives(row: TaxPrimitives): Tax {
    return new Tax(
      TaxId.of(row.id),
      TenantId.of(row.tenantId),
      CatalogCode.of(row.code),
      TaxName.of(row.name),
      TaxRate.of(row.rate),
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): TaxPrimitives {
    return { ...this.recordPrimitives(), name: this.name.value, rate: this.rate.value };
  }

  update(name: TaxName, rate: TaxRate, now: Date): void {
    this.name = name;
    this.rate = rate;
    this.touch(now);
  }
}
