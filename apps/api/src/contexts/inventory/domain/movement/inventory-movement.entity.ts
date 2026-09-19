import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { UnitCost } from '../quantity/unit-cost.vo.js';

export class MovementId extends Uuid {
  static of(value: string): MovementId {
    return new MovementId(value);
  }
}

export type StockDirection = 'in' | 'out';

// Que documento movio la existencia. El ajuste lo escribe el inventario; la entrada de
// mercancia y el despacho, compras y ventas a traves de DocumentStockPosting.
export type MovementOriginType = 'adjustment' | 'receipt' | 'dispatch';

export interface MovementOrigin {
  type: MovementOriginType;
  id: string;
  lineId: string | null;
  // El dia que el documento declara. No tiene por que ser el de la publicacion: un ajuste
  // fechado en agosto puede confirmarse en septiembre.
  date: string;
}

export interface InventoryMovementPrimitives {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  sequence: number;
  direction: StockDirection;
  quantity: number;
  unitCost: number;
  balanceQuantity: number;
  balanceAverageCost: number;
  originType: MovementOriginType;
  originId: string;
  originLineId: string | null;
  originDate: string;
  reversalOfId: string | null;
  occurredAt: Date;
}

// Una fila del kardex. No tiene ningun metodo que la cambie: un error se corrige con otro
// movimiento que la revierte, nunca editandola.
export class InventoryMovement {
  private constructor(
    readonly id: MovementId,
    readonly tenantId: TenantId,
    readonly itemId: ItemRef,
    readonly warehouseId: WarehouseRef,
    readonly sequence: number,
    readonly direction: StockDirection,
    readonly quantity: Quantity,
    readonly unitCost: UnitCost,
    readonly balanceQuantity: Quantity,
    readonly balanceAverageCost: UnitCost,
    readonly origin: MovementOrigin,
    readonly reversalOfId: MovementId | null,
    readonly occurredAt: Date,
  ) {}

  static record(fields: {
    id: MovementId;
    tenantId: TenantId;
    itemId: ItemRef;
    warehouseId: WarehouseRef;
    sequence: number;
    direction: StockDirection;
    quantity: Quantity;
    unitCost: UnitCost;
    balanceQuantity: Quantity;
    balanceAverageCost: UnitCost;
    origin: MovementOrigin;
    reversalOfId: MovementId | null;
    occurredAt: Date;
  }): InventoryMovement {
    return new InventoryMovement(
      fields.id,
      fields.tenantId,
      fields.itemId,
      fields.warehouseId,
      fields.sequence,
      fields.direction,
      fields.quantity,
      fields.unitCost,
      fields.balanceQuantity,
      fields.balanceAverageCost,
      fields.origin,
      fields.reversalOfId,
      fields.occurredAt,
    );
  }

  static fromPrimitives(row: InventoryMovementPrimitives): InventoryMovement {
    return new InventoryMovement(
      MovementId.of(row.id),
      TenantId.of(row.tenantId),
      ItemRef.of(row.itemId),
      WarehouseRef.of(row.warehouseId),
      row.sequence,
      row.direction,
      Quantity.of(row.quantity),
      UnitCost.of(row.unitCost),
      Quantity.of(row.balanceQuantity),
      UnitCost.of(row.balanceAverageCost),
      { type: row.originType, id: row.originId, lineId: row.originLineId, date: row.originDate },
      row.reversalOfId ? MovementId.of(row.reversalOfId) : null,
      row.occurredAt,
    );
  }

  toPrimitives(): InventoryMovementPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      itemId: this.itemId.value,
      warehouseId: this.warehouseId.value,
      sequence: this.sequence,
      direction: this.direction,
      quantity: this.quantity.toNumber(),
      unitCost: this.unitCost.toNumber(),
      balanceQuantity: this.balanceQuantity.toNumber(),
      balanceAverageCost: this.balanceAverageCost.toNumber(),
      originType: this.origin.type,
      originId: this.origin.id,
      originLineId: this.origin.lineId,
      originDate: this.origin.date,
      reversalOfId: this.reversalOfId?.value ?? null,
      occurredAt: this.occurredAt,
    };
  }

  // Lo que suma a la existencia: positivo si entra, negativo si sale. La existencia es la
  // suma de esto sobre todos los movimientos, y hay una prueba que lo exige.
  signedUnits(): bigint {
    return this.direction === 'in' ? this.quantity.units : -this.quantity.units;
  }
}
