import { InvalidItemPriceError } from '../errors/item.errors.js';
import { PriceListRef } from '../shared/references.vo.js';
import { SalePrice } from './sale-price.vo.js';

export interface ItemPricePrimitives {
  priceListId: string;
  price: number;
}

// Lo que cuesta el articulo en UNA lista, en su unidad base. Venderlo en otra unidad multiplica
// este precio por el factor de conversion, que es donde se pierde el companero.
export class ItemPrice {
  private constructor(
    readonly priceListId: PriceListRef,
    readonly price: SalePrice,
  ) {}

  static of(row: ItemPricePrimitives): ItemPrice {
    return new ItemPrice(PriceListRef.of(row.priceListId), SalePrice.of(row.price));
  }

  toPrimitives(): ItemPricePrimitives {
    return { priceListId: this.priceListId.value, price: this.price.toNumber() };
  }
}

// Los precios de un articulo, uno por lista como mucho.
export class ItemPrices {
  private constructor(private readonly prices: ItemPrice[]) {}

  static of(prices: ItemPrice[]): ItemPrices {
    const ids = prices.map((price) => price.priceListId.value);

    if (new Set(ids).size !== ids.length) throw new InvalidItemPriceError('a price list appears more than once.');

    return new ItemPrices([...prices].sort((left, right) => left.priceListId.value.localeCompare(right.priceListId.value)));
  }

  static fromPrimitives(rows: ItemPricePrimitives[]): ItemPrices {
    return ItemPrices.of(rows.map((row) => ItemPrice.of(row)));
  }

  static none(): ItemPrices {
    return new ItemPrices([]);
  }

  priceListIds(): PriceListRef[] {
    return this.prices.map((price) => price.priceListId);
  }

  all(): ItemPrice[] {
    return [...this.prices];
  }

  toPrimitives(): ItemPricePrimitives[] {
    return this.prices.map((price) => price.toPrimitives());
  }
}
