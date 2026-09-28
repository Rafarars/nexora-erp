import { describe, expect, it } from 'vitest';
import { InsufficientStockError } from '../errors/inventory.errors.js';
import { MovementId } from '../movement/inventory-movement.entity.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { UnitCost } from '../quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { MAIN, NOW, TENANT_A, TODAY, WATER } from '../testing/inventory.mother.js';
import { ItemStock } from './item-stock.entity.js';

const origin = { type: 'adjustment' as const, id: '00000000-0000-4000-8000-00000000aaaa', lineId: null, date: TODAY };
let issued = 0;
const nextId = () => MovementId.of(`00000000-0000-4000-8000-${String(++issued).padStart(12, '0')}`);
const emptyStock = () => ItemStock.empty(TenantId.of(TENANT_A), ItemRef.of(WATER), WarehouseRef.of(MAIN), NOW);
const q = (value: number) => Quantity.of(value);
const c = (value: number) => UnitCost.of(value);

describe('ItemStock', () => {
  it('receives stock and records the balance in the movement', () => {
    const stock = emptyStock();

    const movement = stock.receive(q(10), c(2), origin, nextId(), NOW);

    expect(stock.available().toNumber()).toBe(10);
    expect(movement.toPrimitives()).toMatchObject({
      direction: 'in',
      quantity: 10,
      unitCost: 2,
      balanceQuantity: 10,
      balanceAverageCost: 2,
      sequence: 1,
    });
  });

  // 10 a 2 y 30 a 4: 40 unidades que valen 140, a 3,5 cada una.
  it('recalculates the weighted average cost on each entry', () => {
    const stock = emptyStock();

    stock.receive(q(10), c(2), origin, nextId(), NOW);
    stock.receive(q(30), c(4), origin, nextId(), NOW);

    expect(stock.currentAverageCost().toNumber()).toBe(3.5);
  });

  it('values an exit at the current average and does not change it', () => {
    const stock = emptyStock();
    stock.receive(q(10), c(2), origin, nextId(), NOW);
    stock.receive(q(30), c(4), origin, nextId(), NOW);

    const movement = stock.release(q(5), origin, nextId(), NOW);

    expect(movement.toPrimitives()).toMatchObject({ direction: 'out', unitCost: 3.5, balanceQuantity: 35 });
    expect(stock.currentAverageCost().toNumber()).toBe(3.5);
  });

  // La guarda de inventario en cero: no se saca mas de lo que hay, y nada cambia.
  it('refuses to release more than it has and stays untouched', () => {
    const stock = emptyStock();
    stock.receive(q(3), c(1), origin, nextId(), NOW);

    expect(() => stock.release(q(3.0001), origin, nextId(), NOW)).toThrow(InsufficientStockError);
    expect(stock.available().toNumber()).toBe(3);
    expect(stock.toPrimitives().lastSequence).toBe(1);
  });

  it('can release exactly what it has, down to zero', () => {
    const stock = emptyStock();
    stock.receive(q(3), c(1), origin, nextId(), NOW);

    stock.release(q(3), origin, nextId(), NOW);

    expect(stock.available().isZero()).toBe(true);
  });

  it('numbers its movements one after the other', () => {
    const stock = emptyStock();

    const sequences = [
      stock.receive(q(5), c(1), origin, nextId(), NOW),
      stock.release(q(1), origin, nextId(), NOW),
      stock.receive(q(1), c(1), origin, nextId(), NOW),
    ].map((movement) => movement.sequence);

    expect(sequences).toEqual([1, 2, 3]);
  });

  describe('reversing', () => {
    it('reverses an entry with an exit that cites it and takes its value out of the average', () => {
      const stock = emptyStock();
      stock.receive(q(10), c(2), origin, nextId(), NOW);
      const entry = stock.receive(q(30), c(4), origin, nextId(), NOW);

      const reversal = stock.reverse(entry, origin, nextId(), NOW);

      expect(reversal.toPrimitives()).toMatchObject({ direction: 'out', quantity: 30, unitCost: 4, reversalOfId: entry.id.value });
      expect(stock.available().toNumber()).toBe(10);
      expect(stock.currentAverageCost().toNumber()).toBe(2);
    });

    it('reverses an exit by bringing it back at the cost it left with', () => {
      const stock = emptyStock();
      stock.receive(q(10), c(2), origin, nextId(), NOW);
      const exit = stock.release(q(4), origin, nextId(), NOW);

      const reversal = stock.reverse(exit, origin, nextId(), NOW);

      expect(reversal.toPrimitives()).toMatchObject({ direction: 'in', quantity: 4, unitCost: 2 });
      expect(stock.available().toNumber()).toBe(10);
      expect(stock.currentAverageCost().toNumber()).toBe(2);
    });

    // Lo que entro ya salio: revertir la entrada dejaria la existencia negativa.
    it('refuses to reverse an entry whose goods already left', () => {
      const stock = emptyStock();
      const entry = stock.receive(q(10), c(2), origin, nextId(), NOW);
      stock.release(q(8), origin, nextId(), NOW);

      expect(() => stock.reverse(entry, origin, nextId(), NOW)).toThrow(InsufficientStockError);
      expect(stock.available().toNumber()).toBe(2);
    });

    it('keeps the average when a reversal leaves nothing', () => {
      const stock = emptyStock();
      const entry = stock.receive(q(10), c(2), origin, nextId(), NOW);

      stock.reverse(entry, origin, nextId(), NOW);

      expect(stock.available().isZero()).toBe(true);
      expect(stock.currentAverageCost().toNumber()).toBe(2);
    });
  });

  describe('restoring', () => {
    it('restores an exit partially, entering at the exit frozen cost and recalculating average', () => {
      const stock = emptyStock();
      stock.receive(q(10), c(2), origin, nextId(), NOW);
      const exit = stock.release(q(6), origin, nextId(), NOW);
      stock.receive(q(4), c(5), origin, nextId(), NOW); // 4 a 2 + 4 a 5 = 28 / 8 = 3.5

      // Cliente devuelve 2 de las 6 despachadas
      const restoration = stock.restore(exit, q(2), origin, nextId(), NOW);

      expect(restoration.toPrimitives()).toMatchObject({
        direction: 'in',
        quantity: 2,
        unitCost: 2,
        reversalOfId: null,
        restoresMovementId: exit.id.value,
      });
      expect(stock.available().toNumber()).toBe(10);
      // (8 * 3.5 + 2 * 2) / 10 = (28 + 4) / 10 = 3.2
      expect(stock.currentAverageCost().toNumber()).toBe(3.2);
    });

    it('restores an entry partially (purchase return), exiting at frozen cost and recalculating average (H8 §3.8)', () => {
      const stock = emptyStock();
      stock.receive(q(10), c(2), origin, nextId(), NOW);
      const entry2 = stock.receive(q(10), c(4), origin, nextId(), NOW); // 20 unidades, valor 60, promedio 3

      // Se devuelven al proveedor 5 de la segunda entrada a costo congelado de 4 (distinto del promedio 3)
      const restoration = stock.restore(entry2, q(5), origin, nextId(), NOW);

      expect(restoration.toPrimitives()).toMatchObject({
        direction: 'out',
        quantity: 5,
        unitCost: 4,
        reversalOfId: null,
        restoresMovementId: entry2.id.value,
      });
      expect(stock.available().toNumber()).toBe(15);
      // Valor remanente = 60 - (5 * 4) = 40. Promedio = 40 / 15 = 2.666667
      expect(stock.currentAverageCost().toNumber()).toBe(2.666667);
    });

    it('refuses to restore an entry whose goods are not available', () => {
      const stock = emptyStock();
      const entry = stock.receive(q(10), c(2), origin, nextId(), NOW);
      stock.release(q(8), origin, nextId(), NOW);

      // Solo quedan 2, intentar devolver 5 al proveedor falla
      expect(() => stock.restore(entry, q(5), origin, nextId(), NOW)).toThrow(InsufficientStockError);
      expect(stock.available().toNumber()).toBe(2);
    });
  });

  // La propiedad que el kardex protege, sobre una secuencia larga con decimales.
  it('always equals the signed sum of its movements', () => {
    const stock = emptyStock();
    const movements = [
      stock.receive(q(10.1), c(1.1), origin, nextId(), NOW),
      stock.receive(q(0.2), c(3), origin, nextId(), NOW),
      stock.release(q(0.3), origin, nextId(), NOW),
      stock.receive(q(5.5555), c(0.333333), origin, nextId(), NOW),
      stock.release(q(10), origin, nextId(), NOW),
    ];
    movements.push(stock.reverse(movements[2], origin, nextId(), NOW));

    const sum = movements.reduce((total, movement) => total + movement.signedUnits(), 0n);

    expect(sum).toBe(stock.available().units);
    expect(movements.at(-1)?.balanceQuantity.units).toBe(stock.available().units);
  });

  it('survives a round trip to primitives', () => {
    const stock = emptyStock();
    stock.receive(q(7.25), c(1.5), origin, nextId(), NOW);

    expect(ItemStock.fromPrimitives(stock.toPrimitives()).toPrimitives()).toEqual(stock.toPrimitives());
  });
});
