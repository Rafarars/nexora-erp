import { InsufficientStockError } from '../errors/inventory.errors.js';
import { InventoryMovement, MovementId, MovementOrigin } from '../movement/inventory-movement.entity.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { UnitCost, roundedDivision } from '../quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export interface ItemStockPrimitives {
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  averageCost: number;
  lastSequence: number;
  updatedAt: Date;
}

// La existencia de un articulo en una bodega. Es DERIVADA: solo cambia al registrar un
// movimiento, y cada metodo que la cambia devuelve el movimiento que lo explica. No hay
// forma de tocar la cantidad sin dejar rastro en el kardex.
export class ItemStock {
  private constructor(
    readonly tenantId: TenantId,
    readonly itemId: ItemRef,
    readonly warehouseId: WarehouseRef,
    private quantity: Quantity,
    private averageCost: UnitCost,
    private lastSequence: number,
    private updatedAt: Date,
  ) {}

  static empty(tenantId: TenantId, itemId: ItemRef, warehouseId: WarehouseRef, now: Date): ItemStock {
    return new ItemStock(tenantId, itemId, warehouseId, Quantity.zero(), UnitCost.zero(), 0, now);
  }

  static fromPrimitives(row: ItemStockPrimitives): ItemStock {
    return new ItemStock(
      TenantId.of(row.tenantId),
      ItemRef.of(row.itemId),
      WarehouseRef.of(row.warehouseId),
      Quantity.of(row.quantity),
      UnitCost.of(row.averageCost),
      row.lastSequence,
      row.updatedAt,
    );
  }

  toPrimitives(): ItemStockPrimitives {
    return {
      tenantId: this.tenantId.value,
      itemId: this.itemId.value,
      warehouseId: this.warehouseId.value,
      quantity: this.quantity.toNumber(),
      averageCost: this.averageCost.toNumber(),
      lastSequence: this.lastSequence,
      updatedAt: this.updatedAt,
    };
  }

  available(): Quantity {
    return this.quantity;
  }

  currentAverageCost(): UnitCost {
    return this.averageCost;
  }

  // Entra mercancia valorada: el promedio ponderado se recalcula con lo que habia y lo que
  // llega. Es lo que hace que una salida posterior cueste lo que de verdad costo.
  receive(quantity: Quantity, unitCost: UnitCost, origin: MovementOrigin, id: MovementId, now: Date): InventoryMovement {
    const total = this.quantity.plus(quantity);
    const value = this.quantity.units * this.averageCost.micros + quantity.units * unitCost.micros;

    this.averageCost = total.isZero() ? this.averageCost : UnitCost.fromMicros(roundedDivision(value, total.units));
    this.quantity = total;

    return this.record('in', quantity, unitCost, origin, id, null, now);
  }

  // Sale mercancia valorada al promedio vigente, que no cambia. Pedir mas de lo que hay se
  // rechaza antes de tocar nada.
  release(quantity: Quantity, origin: MovementOrigin, id: MovementId, now: Date): InventoryMovement {
    this.ensureAvailable(quantity);
    this.quantity = this.quantity.minus(quantity);

    return this.record('out', quantity, this.averageCost, origin, id, null, now);
  }

  // Deshace un movimiento con otro de sentido contrario que lo cita. Revertir una entrada
  // saca su valor del promedio; revertir una salida la devuelve al costo al que salio.
  reverse(original: InventoryMovement, origin: MovementOrigin, id: MovementId, now: Date): InventoryMovement {
    if (original.direction === 'out') {
      const total = this.quantity.plus(original.quantity);
      const value = this.quantity.units * this.averageCost.micros + original.quantity.units * original.unitCost.micros;

      this.averageCost = UnitCost.fromMicros(roundedDivision(value, total.units));
      this.quantity = total;

      return this.record('in', original.quantity, original.unitCost, origin, id, original.id, now);
    }

    this.ensureAvailable(original.quantity);

    const remaining = this.quantity.minus(original.quantity);
    const value = this.quantity.units * this.averageCost.micros - original.quantity.units * original.unitCost.micros;

    // Si ya no queda nada, el promedio se conserva; si la resta diera negativo por salidas
    // valoradas entre medias, se lleva a cero en vez de inventar un costo negativo.
    if (!remaining.isZero()) {
      this.averageCost = value <= 0n ? UnitCost.zero() : UnitCost.fromMicros(roundedDivision(value, remaining.units));
    }

    this.quantity = remaining;

    return this.record('out', original.quantity, original.unitCost, origin, id, original.id, now);
  }

  private ensureAvailable(quantity: Quantity): void {
    if (quantity.isGreaterThan(this.quantity)) {
      throw new InsufficientStockError(
        this.itemId.value,
        this.warehouseId.value,
        this.quantity.toNumber(),
        quantity.toNumber(),
      );
    }
  }

  private record(
    direction: 'in' | 'out',
    quantity: Quantity,
    unitCost: UnitCost,
    origin: MovementOrigin,
    id: MovementId,
    reversalOfId: MovementId | null,
    now: Date,
  ): InventoryMovement {
    this.lastSequence += 1;
    this.updatedAt = now;

    return InventoryMovement.record({
      id,
      tenantId: this.tenantId,
      itemId: this.itemId,
      warehouseId: this.warehouseId,
      sequence: this.lastSequence,
      direction,
      quantity,
      unitCost,
      balanceQuantity: this.quantity,
      balanceAverageCost: this.averageCost,
      origin,
      reversalOfId,
      occurredAt: now,
    });
  }
}
