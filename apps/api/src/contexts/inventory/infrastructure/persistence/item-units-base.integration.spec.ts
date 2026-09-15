import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ITEM_A, UNIT_BOX, aCategory, aTax, aUnit, anItem } from '../../domain/testing/item.mother.js';
import { PrismaItemPortsHarness } from '../testing/prisma-item-ports.harness.js';

// Lo que el dominio ya impide, garantizado tambien por la base: quien escriba sin pasar por el
// dominio no puede dejar un articulo con dos unidades base.
describe('item_units in PostgreSQL', () => {
  const harness = new PrismaItemPortsHarness();

  beforeEach(async () => {
    await harness.reset();
    const catalog = harness.catalog();

    await catalog.category(aCategory());
    await catalog.tax(aTax());
    await catalog.unit(aUnit());
    await catalog.unit(aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja' }));
    await harness.ports().items.save(anItem());
  });

  afterAll(async () => {
    await harness.reset();
    await harness.close();
  });

  it('refuses a second base unit for the same item', async () => {
    await expect(harness.insertUnit({ itemId: ITEM_A, unitId: UNIT_BOX, conversionFactor: 1, isBase: true })).rejects.toThrow();
  });

  it('still accepts a secondary unit', async () => {
    await expect(harness.insertUnit({ itemId: ITEM_A, unitId: UNIT_BOX, conversionFactor: 24, isBase: false })).resolves.toBeUndefined();
  });
});
