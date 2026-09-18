import { roundedDivision } from '../../../../../shared/domain/amount.js';
import { DocumentRateSet } from '../../../../../shared/domain/ports/document-rates.js';
import { SalesPriceList, SellableItem } from '../../catalog/sales-catalog.js';
import { SalesPriceBelowMinimumError } from '../../errors/sales.errors.js';
import { UnitPrice } from '../../shared/money.js';
import { priceForDocument } from './sales-price.js';

const scaled = (value: number): bigint => BigInt(Math.round(value * 100_000_000));

// Todo lo que hace falta para poner precio a una linea, ya resuelto: con que lista se cotiza, la
// tasa de esa lista, las tasas del documento y cuantos decimales usa la empresa.
export class SalesPricing {
  constructor(
    private readonly priceList: SalesPriceList | null,
    private readonly listRate: number | null,
    private readonly document: DocumentRateSet,
    private readonly decimals: number,
  ) {}

  // Sin lista, sin precio cargado en ella o sin unidad valida, no se sugiere nada: el campo queda
  // en blanco y lo escribe la persona, que es como funcionaba antes de haber listas.
  suggest(item: SellableItem, conversionFactor: number): UnitPrice | null {
    if (!this.priceList) return null;

    const found = item.prices.find((price) => price.priceListId === this.priceList?.id);

    if (!found) return null;

    return priceForDocument(UnitPrice.of(found.price), conversionFactor, this.decimals, this.conversion());
  }

  priceListId(): string | null {
    return this.priceList?.id ?? null;
  }

  // El minimo del articulo esta en la moneda de la empresa: el precio de la linea se lleva alli
  // por el bolivar antes de compararlo. Sin esta conversion, vender en otra moneda dejaria pasar
  // precios por debajo del piso, que es justo el hueco que tiene el companero.
  ensureAboveMinimum(item: SellableItem, price: UnitPrice): void {
    if (item.minPrice === null) return;

    const inCompanyCurrency = roundedDivision(price.micros * scaled(this.document.exchangeRate), scaled(this.document.baseExchangeRate));

    if (inCompanyCurrency < UnitPrice.of(item.minPrice).micros) throw new SalesPriceBelowMinimumError(item.id);
  }

  // Nada que convertir si la lista ya esta en la moneda del documento.
  private conversion(): { listRate: number; documentRate: number } | null {
    if (!this.priceList || this.listRate === null || this.priceList.currency === this.document.currency) return null;

    return { listRate: this.listRate, documentRate: this.document.exchangeRate };
  }
}

// La tasa no se pide cuando no hace falta: una lista en la moneda del documento no se convierte.
export function needsListRate(priceList: SalesPriceList | null, documentCurrency: string): boolean {
  return priceList !== null && priceList.currency !== documentCurrency;
}
