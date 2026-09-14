import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { DispatchExceedsPendingError } from '../errors/sales.errors.js';
import { TaxRate, UnitPrice, lineSubtotalCents, taxCents } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class SalesOrderLineId extends Uuid {
  static of(value: string): SalesOrderLineId {
    return new SalesOrderLineId(value);
  }
}

export interface SalesOrderLinePrimitives {
  id: string;
  lineNumber: number;
  itemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  taxRate: number;
  dispatchedQuantity: number;
}

// Una linea ya validada contra el catalogo. Lo despachado se lleva en la unidad de la linea;
// lo pendiente de un pedido confirmado es lo que queda reservado.
export class SalesOrderLine {
  private constructor(
    readonly id: SalesOrderLineId,
    readonly lineNumber: number,
    readonly itemId: ItemRef,
    readonly unitId: UnitRef,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    readonly unitPrice: UnitPrice,
    readonly taxRate: TaxRate,
    private dispatched: Quantity,
  ) {}

  static of(fields: {
    id: SalesOrderLineId;
    lineNumber: number;
    itemId: ItemRef;
    unitId: UnitRef;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitPrice: UnitPrice;
    taxRate: TaxRate;
  }): SalesOrderLine {
    return new SalesOrderLine(fields.id, fields.lineNumber, fields.itemId, fields.unitId, fields.quantity, fields.baseQuantity, fields.unitPrice, fields.taxRate, Quantity.zero());
  }

  static fromPrimitives(row: SalesOrderLinePrimitives): SalesOrderLine {
    return new SalesOrderLine(
      SalesOrderLineId.of(row.id),
      row.lineNumber,
      ItemRef.of(row.itemId),
      UnitRef.of(row.unitId),
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      UnitPrice.of(row.unitPrice),
      TaxRate.of(row.taxRate),
      Quantity.of(row.dispatchedQuantity),
    );
  }

  toPrimitives(): SalesOrderLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      itemId: this.itemId.value,
      unitId: this.unitId.value,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitPrice: this.unitPrice.toNumber(),
      taxRate: this.taxRate.toNumber(),
      dispatchedQuantity: this.dispatched.toNumber(),
    };
  }

  dispatchedQuantity(): Quantity {
    return this.dispatched;
  }

  pending(): Quantity {
    return this.quantity.minus(this.dispatched);
  }

  // Lo pendiente en unidad base: lo que el pedido tiene reservado en la bodega.
  pendingBase(): Quantity {
    return this.baseQuantity.proportionOf(this.pending(), this.quantity);
  }

  // Una cantidad en la unidad de la linea, en unidad base: 2 de 10 cajas son 48 unidades.
  baseOf(quantity: Quantity): Quantity {
    return this.baseQuantity.proportionOf(quantity, this.quantity);
  }

  isFullyDispatched(): boolean {
    return this.dispatched.equals(this.quantity);
  }

  subtotalCents(): bigint {
    return lineSubtotalCents(this.quantity, this.unitPrice);
  }

  taxCents(): bigint {
    return taxCents(this.subtotalCents(), this.taxRate);
  }

  dispatch(quantity: Quantity): void {
    if (quantity.isGreaterThan(this.pending())) {
      throw new DispatchExceedsPendingError(this.id.value, this.pending().toNumber(), quantity.toNumber());
    }

    this.dispatched = this.dispatched.plus(quantity);
  }

  // Deshace lo que registro un despacho anulado. Quitar mas de lo despachado seria un error de
  // programa, y Quantity lo rechaza.
  undispatch(quantity: Quantity): void {
    this.dispatched = this.dispatched.minus(quantity);
  }
}
