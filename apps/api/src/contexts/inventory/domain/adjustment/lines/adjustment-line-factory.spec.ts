import { describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { InMemoryInventoryCatalog } from '../../../infrastructure/testing/in-memory-inventory-catalog.js';
import {
  CostOnOutgoingLineError,
  InactiveStockItemError,
  InactiveStockWarehouseError,
  InvalidDirectionError,
  InvalidQuantityError,
  ServiceHasNoStockError,
  StockItemNotFoundError,
  StockWarehouseNotFoundError,
  FractionalQuantityError,
  UnitNotOfItemError,
} from '../../errors/inventory.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import {
  BOX,
  CLOSED,
  FOREIGN_ITEM,
  FOREIGN_WAREHOUSE,
  INACTIVE_ITEM,
  KILO,
  MAIN,
  PIECE,
  SERVICE,
  TENANT_A,
  WATER,
  stockWarehouses,
  stockableItems,
} from '../../testing/inventory.mother.js';
import { AdjustmentLineFactory } from './adjustment-line-factory.js';

const factory = () => new AdjustmentLineFactory(new InMemoryInventoryCatalog(stockableItems(), stockWarehouses()), new SequentialIdGenerator());
const tenant = TenantId.of(TENANT_A);
const line = (overrides = {}) => ({ itemId: WATER, unitId: PIECE, direction: 'in', quantity: 5, ...overrides });

describe('AdjustmentLineFactory', () => {
  it('converts a line in boxes to base units and numbers the lines', async () => {
    const lines = await factory().lines(tenant, [line({ unitId: BOX, quantity: 2, unitCost: 12 }), line({ direction: 'out', quantity: 1 })]);

    expect(lines.map((built) => built.toPrimitives())).toMatchObject([
      { lineNumber: 1, unitId: BOX, quantity: 2, baseQuantity: 48, unitCost: 12, direction: 'in' },
      { lineNumber: 2, unitId: PIECE, quantity: 1, baseQuantity: 1, unitCost: null, direction: 'out' },
    ]);
  });

  it('accepts the active warehouse of the tenant', async () => {
    expect((await factory().warehouse(tenant, MAIN)).value).toBe(MAIN);
  });

  // Aislamiento: la bodega y el articulo de otra empresa no existen para esta.
  it('treats a warehouse of another tenant as missing', async () => {
    await expect(factory().warehouse(tenant, FOREIGN_WAREHOUSE)).rejects.toThrow(StockWarehouseNotFoundError);
  });

  it('refuses an inactive warehouse', async () => {
    await expect(factory().warehouse(tenant, CLOSED)).rejects.toThrow(InactiveStockWarehouseError);
  });

  it('treats an item of another tenant as missing', async () => {
    await expect(factory().lines(tenant, [line({ itemId: FOREIGN_ITEM })])).rejects.toThrow(StockItemNotFoundError);
  });

  it('refuses an inactive item', async () => {
    await expect(factory().lines(tenant, [line({ itemId: INACTIVE_ITEM })])).rejects.toThrow(InactiveStockItemError);
  });

  it('refuses a service, which has no stock', async () => {
    await expect(factory().lines(tenant, [line({ itemId: SERVICE })])).rejects.toThrow(ServiceHasNoStockError);
  });

  it('refuses a unit the item does not have', async () => {
    await expect(factory().lines(tenant, [line({ unitId: KILO })])).rejects.toThrow(UnitNotOfItemError);
  });

  // Media caja no significa nada, y la unidad es quien lo dice.
  it('refuses half a box when the unit does not admit fractions', async () => {
    await expect(factory().lines(tenant, [line({ unitId: BOX, quantity: 2.5 })])).rejects.toThrow(FractionalQuantityError);
  });

  it('still admits a whole number of boxes', async () => {
    await expect(factory().lines(tenant, [line({ unitId: BOX, quantity: 2 })])).resolves.toHaveLength(1);
  });

  it.each([0, -1, 0.00001])('refuses a quantity of %d', async (quantity) => {
    await expect(factory().lines(tenant, [line({ quantity })])).rejects.toThrow(InvalidQuantityError);
  });

  // Una salida se valora al promedio vigente.
  it('refuses a cost on an outgoing line', async () => {
    await expect(factory().lines(tenant, [line({ direction: 'out', unitCost: 3 })])).rejects.toThrow(CostOnOutgoingLineError);
  });

  it('refuses a direction that is neither in nor out', async () => {
    await expect(factory().lines(tenant, [line({ direction: 'sideways' })])).rejects.toThrow(InvalidDirectionError);
  });
});
