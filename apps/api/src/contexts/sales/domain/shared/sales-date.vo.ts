import { FutureSalesDateError, InvalidSalesDateError } from '../errors/sales.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Un dia del calendario, sin hora ni zona. En este formato se compara como texto.
export class SalesDate {
  private constructor(readonly value: string) {}

  static of(value: string): SalesDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidSalesDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // El 31 de febrero no existe: Date lo convertiria en marzo sin avisar.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidSalesDateError(value);
    }

    return new SalesDate(value);
  }

  static fromDate(date: Date): SalesDate {
    return SalesDate.of(date.toISOString().slice(0, 10));
  }

  // Un pedido, un despacho o una factura registran algo que ya paso. Contra el dia UTC del reloj.
  ensureNotAfter(now: Date): void {
    if (this.value > now.toISOString().slice(0, 10)) {
      throw new FutureSalesDateError(this.value);
    }
  }

  // El vencimiento de una factura: la fecha mas el plazo del cliente.
  plusDays(days: number): SalesDate {
    const date = new Date(`${this.value}T00:00:00.000Z`);

    date.setUTCDate(date.getUTCDate() + days);

    return SalesDate.fromDate(date);
  }

  isBefore(other: SalesDate): boolean {
    return this.value < other.value;
  }
}
