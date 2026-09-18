import { describe, expect, it } from 'vitest';
import { InvalidItemPriceError, PriceBelowMinimumError } from '../errors/item.errors.js';
import { NOW, PRICE_LIST_A, PRICE_LIST_B, anItem } from '../testing/item.mother.js';
import { ItemPrices } from './item-prices.js';
import { SalePrice } from './sale-price.vo.js';

describe('ItemPrices', () => {
  it('keeps one price per list', () => {
    const prices = ItemPrices.fromPrimitives([
      { priceListId: PRICE_LIST_B, price: 0.7 },
      { priceListId: PRICE_LIST_A, price: 0.85 },
    ]);

    expect(prices.toPrimitives()).toEqual([
      { priceListId: PRICE_LIST_A, price: 0.85 },
      { priceListId: PRICE_LIST_B, price: 0.7 },
    ]);
  });

  it('refuses the same list twice', () => {
    expect(() =>
      ItemPrices.fromPrimitives([
        { priceListId: PRICE_LIST_A, price: 1 },
        { priceListId: PRICE_LIST_A, price: 2 },
      ]),
    ).toThrow(InvalidItemPriceError);
  });

  it('refuses a negative price and one with more than six decimals', () => {
    expect(() => SalePrice.of(-1)).toThrow(InvalidItemPriceError);
    expect(() => SalePrice.of(1.1234567)).toThrow(InvalidItemPriceError);
    expect(SalePrice.of(1.123456).toNumber()).toBe(1.123456);
  });

  // Cero es regalar: se decide a mano en la linea, pero como precio de lista es valido.
  it('accepts zero', () => {
    expect(SalePrice.of(0).toNumber()).toBe(0);
  });
});

describe('Item with a minimum price', () => {
  it('refuses a list price below the minimum', () => {
    expect(() => anItem({ minPrice: 2, prices: ItemPrices.fromPrimitives([{ priceListId: PRICE_LIST_A, price: 1.99 }]) })).toThrow(
      PriceBelowMinimumError,
    );
  });

  it('accepts a list price equal to the minimum', () => {
    const item = anItem({ minPrice: 2, prices: ItemPrices.fromPrimitives([{ priceListId: PRICE_LIST_A, price: 2 }]) });

    expect(item.toPrimitives().minPrice).toBe(2);
  });

  // Sin minimo declarado, cualquier precio de lista vale.
  it('accepts any price when the item has no minimum', () => {
    const item = anItem({ prices: ItemPrices.fromPrimitives([{ priceListId: PRICE_LIST_A, price: 0.01 }]) });

    expect(item.toPrimitives().prices).toEqual([{ priceListId: PRICE_LIST_A, price: 0.01 }]);
  });

  it('refuses to lower the minimum below a price already loaded', () => {
    const item = anItem({ prices: ItemPrices.fromPrimitives([{ priceListId: PRICE_LIST_A, price: 1 }]) });
    const details = { ...item.toPrimitives(), minPrice: 2 };

    expect(() => anItem({ minPrice: details.minPrice, prices: ItemPrices.fromPrimitives(details.prices) })).toThrow(
      PriceBelowMinimumError,
    );
    expect(NOW).toBeInstanceOf(Date);
  });
});
