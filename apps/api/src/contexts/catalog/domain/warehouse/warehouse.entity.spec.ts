import { describe, expect, it } from 'vitest';
import { DefaultWarehouseDeactivationError, InactiveDefaultWarehouseError } from '../errors/warehouse.errors.js';
import { LATER, aWarehouse } from '../testing/catalog.mother.js';
import { WarehouseName } from './warehouse-name.vo.js';
import { Warehouse } from './warehouse.entity.js';

describe('Warehouse', () => {
  it('is born active and not default: deciding that needs the other warehouses', () => {
    const warehouse = aWarehouse();

    expect(warehouse.isActive()).toBe(true);
    expect(warehouse.isDefault()).toBe(false);
  });

  it('survives a round trip to primitives', () => {
    const warehouse = aWarehouse({ isDefault: true });

    expect(Warehouse.fromPrimitives(warehouse.toPrimitives()).toPrimitives()).toEqual(warehouse.toPrimitives());
  });

  it('updates its name and address', () => {
    const warehouse = aWarehouse();

    warehouse.update(WarehouseName.of('Central'), ' Av. Principal 1 ', LATER);

    expect(warehouse.toPrimitives()).toMatchObject({ name: 'Central', address: 'Av. Principal 1' });
  });

  // Los documentos sugeriran esta bodega: no puede quedar inactiva.
  it('refuses to deactivate the default warehouse', () => {
    const warehouse = aWarehouse({ isDefault: true });

    expect(() => warehouse.deactivate(LATER)).toThrow(DefaultWarehouseDeactivationError);
    expect(warehouse.isActive()).toBe(true);
  });

  it('deactivates a warehouse that is not the default one', () => {
    const warehouse = aWarehouse();

    warehouse.deactivate(LATER);

    expect(warehouse.isActive()).toBe(false);
  });

  it('refuses to become default while inactive', () => {
    const warehouse = aWarehouse({ active: false });

    expect(() => warehouse.markAsDefault(LATER)).toThrow(InactiveDefaultWarehouseError);
    expect(warehouse.isDefault()).toBe(false);
  });
});
