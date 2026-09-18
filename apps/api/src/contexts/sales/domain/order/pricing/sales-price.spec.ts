import { describe, expect, it } from 'vitest';
import { UnitPrice } from '../../shared/money.js';
import { priceForDocument } from './sales-price.js';

const price = (value: number) => UnitPrice.of(value);

describe('priceForDocument', () => {
  it('leaves the price as it is when the line is in the base unit and the list currency', () => {
    expect(priceForDocument(price(0.85), 1, 6, null).toNumber()).toBe(0.85);
  });

  // El precio de la lista es por pieza: vender una caja de doce cuesta doce veces.
  it('multiplies by the conversion factor of the chosen unit', () => {
    expect(priceForDocument(price(2.5), 12, 6, null).toNumber()).toBe(30);
  });

  it('converts through the bolivar when the list is in another currency', () => {
    // 100 USD a 40 Bs son 4000 Bs; a 44 Bs por euro, 90,909091 euros.
    expect(priceForDocument(price(100), 1, 6, { listRate: 40, documentRate: 44 }).toNumber()).toBe(90.909091);
  });

  it('rounds to the decimals the company uses for prices', () => {
    expect(priceForDocument(price(100), 1, 2, { listRate: 40, documentRate: 44 }).toNumber()).toBe(90.91);
    expect(priceForDocument(price(100), 1, 0, { listRate: 40, documentRate: 44 }).toNumber()).toBe(91);
  });

  // La columna guarda seis decimales: pedir ocho no inventa precision que no cabe.
  it('never keeps more than six decimals', () => {
    expect(priceForDocument(price(100), 1, 8, { listRate: 40, documentRate: 44 }).toNumber()).toBe(90.909091);
  });

  it('applies the factor before converting, not after', () => {
    expect(priceForDocument(price(2.5), 12, 6, { listRate: 40, documentRate: 44 }).toNumber()).toBe(27.272727);
  });

  // Ocho decimales de factor: una pieza de una caja de mil.
  it('handles a factor with eight decimals', () => {
    expect(priceForDocument(price(1000), 0.001, 6, null).toNumber()).toBe(1);
  });
});
