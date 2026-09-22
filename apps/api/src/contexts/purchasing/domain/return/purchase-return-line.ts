import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { UnitCost } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class PurchaseReturnLineId extends Uuid {
  static of(value: string): PurchaseReturnLineId {
    return new PurchaseReturnLineId(value);
  }
}

export interface PurchaseReturnLinePrimitives {
  id: string;
  lineNumber: number;
  receiptLineId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  restoresMovementId: string | null;
}

export class PurchaseReturnLine {
  private constructor(
    readonly id: PurchaseReturnLineId,
    readonly lineNumber: number,
    readonly receiptLineId: string,
    readonly itemId: ItemRef,
    readonly itemSku: string,
    readonly itemName: string,
    readonly unitId: UnitRef,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    readonly unitCost: UnitCost,
    private _restoresMovementId: string | null,
  ) {}

  static of(fields: {
    id: PurchaseReturnLineId;
    lineNumber: number;
    receiptLineId: string;
    itemId: ItemRef;
    itemSku: string;
    itemName: string;
    unitId: UnitRef;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitCost: UnitCost;
    restoresMovementId?: string | null;
  }): PurchaseReturnLine {
    return new PurchaseReturnLine(
      fields.id,
      fields.lineNumber,
      fields.receiptLineId,
      fields.itemId,
      fields.itemSku,
      fields.itemName,
      fields.unitId,
      fields.quantity,
      fields.baseQuantity,
      fields.unitCost,
      fields.restoresMovementId ?? null,
    );
  }

  static fromPrimitives(row: PurchaseReturnLinePrimitives): PurchaseReturnLine {
    return new PurchaseReturnLine(
      PurchaseReturnLineId.of(row.id),
      row.lineNumber,
      row.receiptLineId,
      ItemRef.of(row.itemId),
      row.itemSku,
      row.itemName,
      UnitRef.of(row.unitId),
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      UnitCost.of(row.unitCost),
      row.restoresMovementId,
    );
  }

  get restoresMovementId(): string | null {
    return this._restoresMovementId;
  }

  assignRestoresMovement(movementId: string): void {
    this._restoresMovementId = movementId;
  }

  toPrimitives(): PurchaseReturnLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      receiptLineId: this.receiptLineId,
      itemId: this.itemId.value,
      itemSku: this.itemSku,
      itemName: this.itemName,
      unitId: this.unitId.value,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitCost: this.unitCost.toNumber(),
      restoresMovementId: this._restoresMovementId,
    };
  }
}
