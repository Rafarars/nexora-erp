import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class SalesReturnLineId extends Uuid {
  static of(value: string): SalesReturnLineId {
    return new SalesReturnLineId(value);
  }
}

export interface SalesReturnLinePrimitives {
  id: string;
  lineNumber: number;
  dispatchLineId: string | null;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  restoresMovementId: string | null;
}

export class SalesReturnLine {
  private constructor(
    readonly id: SalesReturnLineId,
    readonly lineNumber: number,
    readonly dispatchLineId: string | null,
    readonly itemId: ItemRef,
    readonly itemSku: string,
    readonly itemName: string,
    readonly unitId: UnitRef,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    readonly unitCost: number,
    readonly restoresMovementId: string | null,
  ) {}

  static of(fields: {
    id: SalesReturnLineId;
    lineNumber: number;
    dispatchLineId: string | null;
    itemId: ItemRef;
    itemSku: string;
    itemName: string;
    unitId: UnitRef;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitCost?: number;
    restoresMovementId?: string | null;
  }): SalesReturnLine {
    return new SalesReturnLine(
      fields.id,
      fields.lineNumber,
      fields.dispatchLineId,
      fields.itemId,
      fields.itemSku,
      fields.itemName,
      fields.unitId,
      fields.quantity,
      fields.baseQuantity,
      fields.unitCost ?? 0,
      fields.restoresMovementId ?? null,
    );
  }

  static fromPrimitives(row: SalesReturnLinePrimitives): SalesReturnLine {
    return new SalesReturnLine(
      SalesReturnLineId.of(row.id),
      row.lineNumber,
      row.dispatchLineId,
      ItemRef.of(row.itemId),
      row.itemSku,
      row.itemName,
      UnitRef.of(row.unitId),
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      row.unitCost,
      row.restoresMovementId,
    );
  }

  toPrimitives(): SalesReturnLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      dispatchLineId: this.dispatchLineId,
      itemId: this.itemId.value,
      itemSku: this.itemSku,
      itemName: this.itemName,
      unitId: this.unitId.value,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitCost: this.unitCost,
      restoresMovementId: this.restoresMovementId,
    };
  }

  withValuation(unitCost: number, restoresMovementId: string): SalesReturnLine {
    return new SalesReturnLine(
      this.id,
      this.lineNumber,
      this.dispatchLineId,
      this.itemId,
      this.itemSku,
      this.itemName,
      this.unitId,
      this.quantity,
      this.baseQuantity,
      unitCost,
      restoresMovementId,
    );
  }
}
