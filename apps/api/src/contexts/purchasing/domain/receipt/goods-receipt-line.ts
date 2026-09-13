import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { UnitCost } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';
import { PurchaseOrderLineId } from '../order/purchase-order-line.js';

export class GoodsReceiptLineId extends Uuid {
  static of(value: string): GoodsReceiptLineId {
    return new GoodsReceiptLineId(value);
  }
}

export interface GoodsReceiptLinePrimitives {
  id: string;
  lineNumber: number;
  orderLineId: string;
  itemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
}

// Cuanto llego de una linea de la orden, en su misma unidad y a su mismo costo. El articulo
// y la unidad se copian para que la entrada se lea sin abrir la orden.
export class GoodsReceiptLine {
  private constructor(
    readonly id: GoodsReceiptLineId,
    readonly lineNumber: number,
    readonly orderLineId: PurchaseOrderLineId,
    readonly itemId: ItemRef,
    readonly unitId: UnitRef,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    readonly unitCost: UnitCost,
  ) {}

  static of(fields: {
    id: GoodsReceiptLineId;
    lineNumber: number;
    orderLineId: PurchaseOrderLineId;
    itemId: ItemRef;
    unitId: UnitRef;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitCost: UnitCost;
  }): GoodsReceiptLine {
    return new GoodsReceiptLine(
      fields.id,
      fields.lineNumber,
      fields.orderLineId,
      fields.itemId,
      fields.unitId,
      fields.quantity,
      fields.baseQuantity,
      fields.unitCost,
    );
  }

  static fromPrimitives(row: GoodsReceiptLinePrimitives): GoodsReceiptLine {
    return new GoodsReceiptLine(
      GoodsReceiptLineId.of(row.id),
      row.lineNumber,
      PurchaseOrderLineId.of(row.orderLineId),
      ItemRef.of(row.itemId),
      UnitRef.of(row.unitId),
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      UnitCost.of(row.unitCost),
    );
  }

  toPrimitives(): GoodsReceiptLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      orderLineId: this.orderLineId.value,
      itemId: this.itemId.value,
      unitId: this.unitId.value,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitCost: this.unitCost.toNumber(),
    };
  }

  baseUnitCost(): UnitCost {
    return this.unitCost.perBase(this.quantity, this.baseQuantity);
  }
}
