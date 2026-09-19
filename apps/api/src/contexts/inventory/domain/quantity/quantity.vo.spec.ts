import { describe, expect, it } from 'vitest';
import { InvalidQuantityError, InvalidUnitCostError } from '../errors/inventory.errors.js';
import { Quantity } from './quantity.vo.js';
import { UnitCost } from './unit-cost.vo.js';

describe('Quantity', () => {
  it.each([0, 1, 0.0001, 24.5, 1234.5678])('keeps %d exactly', (value) => {
    expect(Quantity.of(value).toNumber()).toBe(value);
  });

  it.each([-1, 0.00001, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (value) => {
    expect(() => Quantity.of(value)).toThrow(InvalidQuantityError);
  });

  // La razon de los enteros: con numeros de coma flotante esto no da 0,3.
  it('adds without floating point drift', () => {
    expect(Quantity.of(0.1).plus(Quantity.of(0.2)).equals(Quantity.of(0.3))).toBe(true);
  });

  it('converts two boxes of 24 into 48 base units', () => {
    expect(Quantity.of(2).times(24).toNumber()).toBe(48);
  });

  // Ocho decimales no caben en cuatro: se redondea a la mitad hacia arriba.
  it('rounds a conversion to four decimals', () => {
    expect(Quantity.of(0.3333).times(0.5).toNumber()).toBe(0.1667);
  });

  // El factor se guarda con ocho decimales, y el calculo tiene que usarlos: si se recorta a
  // cuatro, la docena vuelve a dar 0,9996 y el articulo nunca cuadra.
  it('uses the eight decimals of the factor: twelve pieces of a dozen are one dozen', () => {
    expect(Quantity.of(12).times(0.08333333).toNumber()).toBe(1);
  });

  // Un gramo de un saco de 25 kg es 0,00004: recortado a cuatro decimales seria cero, y el
  // documento entraria sin mover nada.
  it('does not turn a tiny factor into zero', () => {
    expect(Quantity.of(25_000).times(0.00004).toNumber()).toBe(1);
  });

  it('refuses a subtraction that would go below zero', () => {
    expect(() => Quantity.of(1).minus(Quantity.of(2))).toThrow(InvalidQuantityError);
  });
});

describe('UnitCost', () => {
  it.each([0, 0.5, 12.345678])('keeps %d exactly', (value) => {
    expect(UnitCost.of(value).toNumber()).toBe(value);
  });

  it.each([-0.01, 0.0000001, Number.NaN])('rejects %d', (value) => {
    expect(() => UnitCost.of(value)).toThrow(InvalidUnitCostError);
  });

  // Una caja de 24 a 12 es 0,5 por unidad base.
  it('spreads the cost of a line over its base units', () => {
    expect(UnitCost.of(12).perBase(Quantity.of(1), Quantity.of(24)).toNumber()).toBe(0.5);
  });

  it('rounds the spread cost to six decimals', () => {
    expect(UnitCost.of(10).perBase(Quantity.of(1), Quantity.of(3)).toNumber()).toBe(3.333333);
  });
});
