import { DefaultWarehouseDeactivationError, InactiveDefaultWarehouseError } from '../errors/warehouse.errors.js';
import { optionalText } from '../shared/bounded-text.vo.js';
import { CatalogCode, CodePrefix } from '../shared/catalog-code.vo.js';
import { CatalogRecord, CatalogRecordPrimitives } from '../shared/catalog-record.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { WarehouseId } from './warehouse-id.vo.js';
import { WarehouseName } from './warehouse-name.vo.js';

export interface WarehousePrimitives extends CatalogRecordPrimitives {
  name: string;
  address: string | null;
  isDefault: boolean;
}

const ADDRESS_MAX = 500;

export class Warehouse extends CatalogRecord<WarehouseId> {
  static readonly CODE_PREFIX: CodePrefix = 'BOD';

  private constructor(
    id: WarehouseId,
    tenantId: TenantId,
    code: CatalogCode,
    private name: WarehouseName,
    private address: string | null,
    private isDefaultWarehouse: boolean,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, tenantId, code, active, createdAt, updatedAt);
  }

  // Nace sin ser la bodega por defecto: decidirlo exige mirar las demas, y eso lo hace
  // DefaultWarehouse.
  static create(
    id: WarehouseId,
    tenantId: TenantId,
    code: CatalogCode,
    name: WarehouseName,
    address: string | null,
    now: Date,
  ): Warehouse {
    return new Warehouse(
      id,
      tenantId,
      code,
      name,
      optionalText(address, ADDRESS_MAX, 'WarehouseAddress'),
      false,
      true,
      now,
      now,
    );
  }

  static fromPrimitives(row: WarehousePrimitives): Warehouse {
    return new Warehouse(
      WarehouseId.of(row.id),
      TenantId.of(row.tenantId),
      CatalogCode.of(row.code),
      WarehouseName.of(row.name),
      row.address,
      row.isDefault,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): WarehousePrimitives {
    return {
      ...this.recordPrimitives(),
      name: this.name.value,
      address: this.address,
      isDefault: this.isDefaultWarehouse,
    };
  }

  isDefault(): boolean {
    return this.isDefaultWarehouse;
  }

  update(name: WarehouseName, address: string | null, now: Date): void {
    this.name = name;
    this.address = optionalText(address, ADDRESS_MAX, 'WarehouseAddress');
    this.touch(now);
  }

  // Los documentos sugeriran esta bodega: si pudiera desactivarse, la empresa se
  // quedaria sin sugerencia valida.
  override deactivate(now: Date): void {
    if (this.isDefaultWarehouse) {
      throw new DefaultWarehouseDeactivationError(this.id.value);
    }

    super.deactivate(now);
  }

  markAsDefault(now: Date): void {
    if (!this.isActive()) {
      throw new InactiveDefaultWarehouseError(this.id.value);
    }

    this.isDefaultWarehouse = true;
    this.touch(now);
  }

  unmarkAsDefault(now: Date): void {
    this.isDefaultWarehouse = false;
    this.touch(now);
  }
}
