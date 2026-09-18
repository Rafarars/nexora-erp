import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { ReceiptExceedsPendingError } from '../errors/purchasing.errors.js';
import { TaxRate, UnitCost, lineSubtotalUnits, taxUnits } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class PurchaseOrderLineId extends Uuid {
  static of(value: string): PurchaseOrderLineId {
    return new PurchaseOrderLineId(value);
  }
}

export interface PurchaseOrderLinePrimitives {
  id: string;
  lineNumber: number;
  itemId: string;
  // El SKU y el nombre con que se escribio la linea: el documento se reproduce como se emitio
  // aunque el maestro cambie despues.
  itemSku: string;
  itemName: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  taxRate: number;
  receivedQuantity: number;
}

// Una linea ya validada contra el catalogo. Lo recibido se lleva en la unidad de la linea,
// y solo lo mueve la orden cuando registra o revierte una entrada.
export class PurchaseOrderLine {
  private constructor(
    readonly id: PurchaseOrderLineId,
    readonly lineNumber: number,
    readonly itemId: ItemRef,
    readonly itemSku: string,
    readonly itemName: string,
    readonly unitId: UnitRef,
    readonly quantity: Quantity,
    readonly baseQuantity: Quantity,
    readonly unitCost: UnitCost,
    readonly taxRate: TaxRate,
    private received: Quantity,
  ) {}

  static of(fields: {
    id: PurchaseOrderLineId;
    lineNumber: number;
    itemId: ItemRef;
    itemSku: string;
    itemName: string;
    unitId: UnitRef;
    quantity: Quantity;
    baseQuantity: Quantity;
    unitCost: UnitCost;
    taxRate: TaxRate;
  }): PurchaseOrderLine {
    return new PurchaseOrderLine(
      fields.id,
      fields.lineNumber,
      fields.itemId,
      fields.itemSku,
      fields.itemName,
      fields.unitId,
      fields.quantity,
      fields.baseQuantity,
      fields.unitCost,
      fields.taxRate,
      Quantity.zero(),
    );
  }

  static fromPrimitives(row: PurchaseOrderLinePrimitives): PurchaseOrderLine {
    return new PurchaseOrderLine(
      PurchaseOrderLineId.of(row.id),
      row.lineNumber,
      ItemRef.of(row.itemId),
      row.itemSku,
      row.itemName,
      UnitRef.of(row.unitId),
      Quantity.of(row.quantity),
      Quantity.of(row.baseQuantity),
      UnitCost.of(row.unitCost),
      TaxRate.of(row.taxRate),
      Quantity.of(row.receivedQuantity),
    );
  }

  toPrimitives(): PurchaseOrderLinePrimitives {
    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      itemId: this.itemId.value,
      itemSku: this.itemSku,
      itemName: this.itemName,
      unitId: this.unitId.value,
      quantity: this.quantity.toNumber(),
      baseQuantity: this.baseQuantity.toNumber(),
      unitCost: this.unitCost.toNumber(),
      taxRate: this.taxRate.toNumber(),
      receivedQuantity: this.received.toNumber(),
    };
  }

  receivedQuantity(): Quantity {
    return this.received;
  }

  pending(): Quantity {
    return this.quantity.minus(this.received);
  }

  // Lo pendiente en unidad base, que es lo que la bodega espera ver llegar.
  pendingBase(): Quantity {
    return this.baseQuantity.proportionOf(this.pending(), this.quantity);
  }

  // Una cantidad en la unidad de la linea, en unidad base con la proporcion que guardo la orden:
  // 2 de 10 cajas son 48 unidades aunque el articulo cambie despues su caja.
  baseOf(quantity: Quantity): Quantity {
    return this.baseQuantity.proportionOf(quantity, this.quantity);
  }

  isFullyReceived(): boolean {
    return this.received.equals(this.quantity);
  }

  subtotalUnits(decimals: number): bigint {
    return lineSubtotalUnits(this.quantity, this.unitCost, decimals);
  }

  taxUnits(decimals: number): bigint {
    return taxUnits(this.subtotalUnits(decimals), this.taxRate, decimals);
  }

  receive(quantity: Quantity): void {
    if (quantity.isGreaterThan(this.pending())) {
      throw new ReceiptExceedsPendingError(this.id.value, this.pending().toNumber(), quantity.toNumber());
    }

    this.received = this.received.plus(quantity);
  }

  // Deshace lo que registro una entrada anulada. Nunca puede quitar mas de lo recibido:
  // si pasara, seria un error de programa y Quantity lo rechaza.
  unreceive(quantity: Quantity): void {
    this.received = this.received.minus(quantity);
  }
}
