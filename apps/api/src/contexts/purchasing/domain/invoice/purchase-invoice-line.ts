import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { TaxRate, UnitCost, lineSubtotalUnits, taxUnits } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';

export class PurchaseInvoiceLineId extends Uuid {
  static of(value: string): PurchaseInvoiceLineId {
    return new PurchaseInvoiceLineId(value);
  }
}

export interface PurchaseInvoiceLinePrimitives {
  id: string;
  lineNumber: number;
  receiptLineId: string | null;
  orderLineId: string | null;
  itemId: string | null;
  itemSku: string | null;
  itemName: string;
  concept: string | null;
  unitId: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
}

// Una linea de la factura de compra. Puede facturar:
// - Una linea de entrada (mercancia fisica que entro a bodega).
// - Una linea de orden de un servicio (que nunca pasa por entrada).
// - Nada (un servicio o gasto libre sin orden ni entrada).
export class PurchaseInvoiceLine {
  private constructor(
    readonly id: PurchaseInvoiceLineId,
    readonly lineNumber: number,
    readonly receiptLineId: string | null,
    readonly orderLineId: string | null,
    readonly itemId: ItemRef | null,
    readonly itemSku: string | null,
    readonly itemName: string,
    readonly concept: string | null,
    readonly unitId: UnitRef | null,
    readonly quantity: Quantity,
    readonly unitPrice: UnitCost,
    readonly taxRate: TaxRate,
  ) {}

  static of(fields: {
    id: PurchaseInvoiceLineId | string;
    lineNumber: number;
    receiptLineId: string | null;
    orderLineId: string | null;
    itemId: ItemRef | string | null;
    itemSku: string | null;
    itemName: string;
    concept: string | null;
    unitId: UnitRef | string | null;
    quantity: Quantity | number;
    unitPrice: UnitCost | number;
    taxRate: TaxRate | number;
  }): PurchaseInvoiceLine {
    return new PurchaseInvoiceLine(
      typeof fields.id === 'string' ? PurchaseInvoiceLineId.of(fields.id) : fields.id,
      fields.lineNumber,
      fields.receiptLineId,
      fields.orderLineId,
      typeof fields.itemId === 'string' ? ItemRef.of(fields.itemId) : fields.itemId,
      fields.itemSku,
      fields.itemName,
      fields.concept,
      typeof fields.unitId === 'string' ? UnitRef.of(fields.unitId) : fields.unitId,
      typeof fields.quantity === 'number' ? Quantity.of(fields.quantity) : fields.quantity,
      typeof fields.unitPrice === 'number' ? UnitCost.of(fields.unitPrice) : fields.unitPrice,
      typeof fields.taxRate === 'number' ? TaxRate.of(fields.taxRate) : fields.taxRate,
    );
  }

  static fromPrimitives(row: PurchaseInvoiceLinePrimitives): PurchaseInvoiceLine {
    return new PurchaseInvoiceLine(
      PurchaseInvoiceLineId.of(row.id),
      row.lineNumber,
      row.receiptLineId,
      row.orderLineId,
      row.itemId ? ItemRef.of(row.itemId) : null,
      row.itemSku,
      row.itemName,
      row.concept,
      row.unitId ? UnitRef.of(row.unitId) : null,
      Quantity.of(row.quantity),
      UnitCost.of(row.unitPrice),
      TaxRate.of(row.taxRate),
    );
  }

  subtotalUnits(decimals: number): bigint {
    return lineSubtotalUnits(this.quantity, this.unitPrice, decimals);
  }

  taxUnits(decimals: number): bigint {
    return taxUnits(this.subtotalUnits(decimals), this.taxRate, decimals);
  }

  toPrimitives(decimals: number): PurchaseInvoiceLinePrimitives {
    const subtotal = this.subtotalUnits(decimals);
    const tax = this.taxUnits(decimals);
    const total = subtotal + tax;

    return {
      id: this.id.value,
      lineNumber: this.lineNumber,
      receiptLineId: this.receiptLineId,
      orderLineId: this.orderLineId,
      itemId: this.itemId?.value ?? null,
      itemSku: this.itemSku,
      itemName: this.itemName,
      concept: this.concept,
      unitId: this.unitId?.value ?? null,
      quantity: this.quantity.toNumber(),
      unitPrice: this.unitPrice.toNumber(),
      taxRate: this.taxRate.toNumber(),
      subtotal: Number(subtotal) / 10_000,
      tax: Number(tax) / 10_000,
      total: Number(total) / 10_000,
    };
  }
}
