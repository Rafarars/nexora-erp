import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { SalesOrderLineId } from '../order/sales-order-line.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class DispatchLineId extends Uuid {
  static of(value: string): DispatchLineId {
    return new DispatchLineId(value);
  }
}

export interface DispatchLinePrimitives {
  id: string;
  lineNumber: number;
  orderLineId: string;
  itemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
}

// Cuanto salio de una linea del pedido, en su misma unidad. No lleva costo: el inventario la
// valora al promedio vigente. Articulo y unidad se copian para leerla sin abrir el pedido.
export class DispatchLine {
  private constructor(
    readonly id: DispatchLineId,
    readonly lineNumber: number,
    readonly orderLineId: SalesOrderLineId,
    readonly itemId: ItemRef,
    readonly unitId: UnitRef,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
  ) {}

  static of(fields: {
    id: DispatchLineId;
    lineNumber: number;
    orderLineId: SalesOrderLineId;
    itemId: ItemRef;
    unitId: UnitRef;
    quantity: Quantity;
    baseQuantity: Quantity;
  }): DispatchLine {
    return new DispatchLine(fields.id, fields.lineNumber, fields.orderLineId, fields.itemId, fields.unitId, fields.quantity, fields.baseQuantity);
  }

  static fromPrimitives(row: DispatchLinePrimitives): DispatchLine {
    return new DispatchLine(
      DispatchLineId.of(row.id),
      row.lineNumber,
      SalesOrderLineId.of(row.orderLineId),
      ItemRef.of(row.itemId),
      UnitRef.of(row.unitId),
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
    );
  }

  toPrimitives(): DispatchLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      orderLineId: this.orderLineId.value,
      itemId: this.itemId.value,
      unitId: this.unitId.value,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
    };
  }
}
