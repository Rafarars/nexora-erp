import { describe, expect, it } from 'vitest';
import { Quantity } from './quantity.vo.js';

describe('Quantity', () => {
  it('converts two boxes of 24 into 48 base units', () => {
    expect(Quantity.of(2).times(24).toNumber()).toBe(48);
  });

  // El factor del articulo se guarda con ocho decimales y el pedido tiene que usarlos: con
  // cuatro, vender doce piezas de una docena descontaba 0,9996 y la existencia nunca cerraba.
  it('uses the eight decimals of the factor: twelve pieces of a dozen are one dozen', () => {
    expect(Quantity.of(12).times(0.08333333).toNumber()).toBe(1);
  });

  it('does not turn a tiny factor into zero', () => {
    expect(Quantity.of(25_000).times(0.00004).toNumber()).toBe(1);
  });

  // La parte proporcional de un despacho no toca el factor: ya viene en unidad base.
  it('takes the proportional part of a line', () => {
    expect(Quantity.of(48).proportionOf(Quantity.of(1.5), Quantity.of(2)).toNumber()).toBe(36);
  });
});
