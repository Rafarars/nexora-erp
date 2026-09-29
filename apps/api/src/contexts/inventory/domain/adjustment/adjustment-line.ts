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

export type RevaluationKind = 'cost' | 'amount';

export interface AdjustmentLinePrimitives {
  id: string;
  lineNumber: number;
  itemId: string;
  // El SKU y el nombre con que se escribio la linea: el documento no cambia si el maestro cambia.
  itemSku: string;
  itemName: string;
  unitId: string;
  direction: StockDirection;
  quantity: number;
  baseQuantity: number;
  unitCost: number | null;
  revaluationKind?: RevaluationKind | null;
  amount?: number | null;
  sourceMovementId?: string | null;
  stockPart?: number | null;
  soldPart?: number | null;
}

// Una linea ya validada contra el articulo: la unidad es del articulo y la cantidad base
// esta calculada. La construye AdjustmentLineFactory; aqui solo se guarda.
export class AdjustmentLine {
  private constructor(
    readonly id: AdjustmentLineId,
    readonly lineNumber: number,
    readonly itemId: ItemRef,
    readonly itemSku: string,
    readonly itemName: string,
    readonly unitId: UnitRef,
    readonly direction: StockDirection,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    private _unitCost: UnitCost | null,
    readonly revaluationKind: RevaluationKind | null = null,
    readonly amount: number | null = null,
    readonly sourceMovementId: string | null = null,
    private _stockPart: number | null = null,
    private _soldPart: number | null = null,
  ) {}

  get unitCost(): UnitCost | null {
    return this._unitCost;
  }

  get stockPart(): number | null {
    return this._stockPart;
  }

  get soldPart(): number | null {
    return this._soldPart;
  }

  allocateVariance(stockPart: number, soldPart: number, newUnitCost?: UnitCost | null): void {
    this._stockPart = stockPart;
    this._soldPart = soldPart;
    if (newUnitCost !== undefined) {
      this._unitCost = newUnitCost;
    }
  }

  static of(fields: {
    id: AdjustmentLineId;
    lineNumber: number;
    itemId: ItemRef;
    itemSku: string;
    itemName: string;
    unitId: UnitRef;
    direction: StockDirection;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitCost: UnitCost | null;
    revaluationKind?: RevaluationKind | null;
    amount?: number | null;
    sourceMovementId?: string | null;
    stockPart?: number | null;
    soldPart?: number | null;
  }): AdjustmentLine {
    return new AdjustmentLine(
      fields.id,
      fields.lineNumber,
      fields.itemId,
      fields.itemSku,
      fields.itemName,
      fields.unitId,
      fields.direction,
      fields.quantity,
      fields.baseQuantity,
      fields.unitCost,
      fields.revaluationKind ?? null,
      fields.amount ?? null,
      fields.sourceMovementId ?? null,
      fields.stockPart ?? null,
      fields.soldPart ?? null,
    );
  }

  static fromPrimitives(row: AdjustmentLinePrimitives): AdjustmentLine {
    return new AdjustmentLine(
      AdjustmentLineId.of(row.id),
      row.lineNumber,
      ItemRef.of(row.itemId),
      row.itemSku,
      row.itemName,
      UnitRef.of(row.unitId),
      row.direction,
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      row.unitCost === null ? null : UnitCost.of(row.unitCost),
      row.revaluationKind ?? null,
      row.amount ?? null,
      row.sourceMovementId ?? null,
      row.stockPart ?? null,
      row.soldPart ?? null,
    );
  }

  toPrimitives(): AdjustmentLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      itemId: this.itemId.value,
      itemSku: this.itemSku,
      itemName: this.itemName,
      unitId: this.unitId.value,
      direction: this.direction,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitCost: this._unitCost?.toNumber() ?? null,
      revaluationKind: this.revaluationKind,
      amount: this.amount,
      sourceMovementId: this.sourceMovementId,
      stockPart: this._stockPart,
      soldPart: this._soldPart,
    };
  }
}
