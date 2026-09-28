import { EmptyPurchasingTextError, PurchasingTextTooLongError } from '../errors/purchasing.errors.js';

const MAX_LENGTH = 60;

// El numero que el proveedor le dio a su factura. Se normaliza a mayusculas y sin
// espacios en los extremos para que FAC-001 y fac-001 no esquiven la unicidad (H9 §3.1).
export class SupplierInvoiceNumber {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static of(raw: string): SupplierInvoiceNumber {
    if (typeof raw !== 'string') {
      throw new EmptyPurchasingTextError('SupplierInvoiceNumber');
    }
    const normalized = raw.trim().toUpperCase();
    if (normalized.length === 0) {
      throw new EmptyPurchasingTextError('SupplierInvoiceNumber');
    }
    if (normalized.length > MAX_LENGTH) {
      throw new PurchasingTextTooLongError('SupplierInvoiceNumber', MAX_LENGTH);
    }
    return new SupplierInvoiceNumber(normalized);
  }

  equals(other: SupplierInvoiceNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
