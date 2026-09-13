import { FuturePurchaseDateError, InvalidPurchaseDateError } from '../errors/purchasing.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Un dia del calendario, sin hora ni zona. En este formato se compara como texto.
export class PurchaseDate {
  private constructor(readonly value: string) {}

  static of(value: string): PurchaseDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidPurchaseDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // El 31 de febrero no existe: Date lo convertiria en marzo sin avisar.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidPurchaseDateError(value);
    }

    return new PurchaseDate(value);
  }

  static fromDate(date: Date): PurchaseDate {
    return PurchaseDate.of(date.toISOString().slice(0, 10));
  }

  // Una orden o una entrada registran algo que ya paso. Contra el dia UTC del reloj.
  ensureNotAfter(now: Date): void {
    if (this.value > now.toISOString().slice(0, 10)) {
      throw new FuturePurchaseDateError(this.value);
    }
  }

  isBefore(other: PurchaseDate): boolean {
    return this.value < other.value;
  }
}
