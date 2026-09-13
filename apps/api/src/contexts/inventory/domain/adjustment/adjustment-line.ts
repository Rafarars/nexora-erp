import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { StockDirection } from '../movement/inventory-movement.entity.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { UnitCost } from '../quantity/unit-cost.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class AdjustmentLineId extends Uuid {
  static of(value: string): AdjustmentLineId {
    return new AdjustmentLineId(value);
  }
}

export interface AdjustmentLinePrimitives {
  id: string;
  lineNumber: number;
  itemId: string;
  unitId: string;
  direction: StockDirection;
  quantity: number;
  baseQuantity: number;
  unitCost: number | null;
}

// Una linea ya validada contra el catalogo: la unidad es del articulo y la cantidad base
// esta calculada. La construye AdjustmentLineFactory; aqui solo se guarda.
export class AdjustmentLine {
  private constructor(
    readonly id: AdjustmentLineId,
    readonly lineNumber: number,
    readonly itemId: ItemRef,
    readonly unitId: UnitRef,
    readonly direction: StockDirection,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    readonly unitCost: UnitCost | null,
  ) {}

  static of(fields: {
    id: AdjustmentLineId;
    lineNumber: number;
    itemId: ItemRef;
    unitId: UnitRef;
    direction: StockDirection;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitCost: UnitCost | null;
  }): AdjustmentLine {
    return new AdjustmentLine(
      fields.id,
      fields.lineNumber,
      fields.itemId,
      fields.unitId,
      fields.direction,
      fields.quantity,
      fields.baseQuantity,
      fields.unitCost,
    );
  }

  static fromPrimitives(row: AdjustmentLinePrimitives): AdjustmentLine {
    return new AdjustmentLine(
      AdjustmentLineId.of(row.id),
      row.lineNumber,
      ItemRef.of(row.itemId),
      UnitRef.of(row.unitId),
      row.direction,
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      row.unitCost === null ? null : UnitCost.of(row.unitCost),
    );
  }

  toPrimitives(): AdjustmentLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      itemId: this.itemId.value,
      unitId: this.unitId.value,
      direction: this.direction,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitCost: this.unitCost?.toNumber() ?? null,
    };
  }

  // El costo por unidad base: el de la linea repartido entre sus unidades base. Sin costo,
  // la entrada se valora al promedio vigente (un hallazgo en un conteo, por ejemplo).
  baseUnitCost(currentAverage: UnitCost): UnitCost {
    return this.unitCost ? this.unitCost.perBase(this.quantity, this.baseQuantity) : currentAverage;
  }
}
