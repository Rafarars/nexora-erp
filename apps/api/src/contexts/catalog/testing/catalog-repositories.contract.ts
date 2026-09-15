import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CategoryId } from '../domain/category/category-id.vo.js';
import { CategoryName } from '../domain/category/category-name.vo.js';
import {
  DuplicateCategoryNameError,
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
  DuplicateTaxNameError,
  DuplicateWarehouseNameError,
} from '../domain/errors/duplicate.errors.js';
import { ConcurrentDefaultWarehouseError } from '../domain/errors/warehouse.errors.js';
import { MeasurementUnitId } from '../domain/measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../domain/measurement-unit/measurement-unit-name.vo.js';
import { UnitAbbreviation } from '../domain/measurement-unit/unit-abbreviation.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { TaxId } from '../domain/tax/tax-id.vo.js';
import { TaxName } from '../domain/tax/tax-name.vo.js';
import { TaxRate } from '../domain/tax/tax-rate.vo.js';
import {
  CATEGORY_A,
  CATEGORY_B,
  LATER,
  TAX_A,
  TAX_B,
  TENANT_A,
  TENANT_B,
  UNIT_BOX,
  UNIT_KILO,
  UNIT_PIECE,
  WAREHOUSE_A,
  WAREHOUSE_B,
  aCategory,
  aTax,
  aUnit,
  aWarehouse,
} from '../domain/testing/catalog.mother.js';
import { WarehouseId } from '../domain/warehouse/warehouse-id.vo.js';
import { WarehouseName } from '../domain/warehouse/warehouse-name.vo.js';
import { CatalogRepositories, CatalogRepositoriesHarness, ItemSeeder } from './catalog-repositories.harness.js';

const tenantA = TenantId.of(TENANT_A);
const tenantB = TenantId.of(TENANT_B);

// UNA suite ejecutada dos veces: contra los dobles en memoria y contra PostgreSQL. Si
// las dos pasan, los dobles de las pruebas de aplicacion no mienten sobre la base.
export function describeCatalogRepositoriesContract(
  implementation: string,
  createHarness: () => CatalogRepositoriesHarness,
): void {
  describe(`CatalogRepositories contract: ${implementation}`, () => {
    const harness = createHarness();
    let repos: CatalogRepositories;
    let items: ItemSeeder;

    beforeEach(async () => {
      await harness.reset();
      repos = harness.repositories();
      items = harness.items();
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    // Un articulo apunta a categoria, impuesto y unidades: sin ellos la base rechaza la
    // escritura y el doble la aceptaria. Sembrar siempre iguala.
    async function seedReferences(): Promise<void> {
      await repos.categories.save(aCategory());
      await repos.taxes.save(aTax());
      await repos.units.save(aUnit());
      await repos.units.save(aUnit({ id: UNIT_BOX, code: 'UOM000002', name: 'Caja', abbreviation: 'cja' }));
    }

    describe('CodeSequence', () => {
      it('counts from one, per tenant and per prefix', async () => {
        expect(await repos.codes.next(tenantA, 'UOM')).toBe(1);
        expect(await repos.codes.next(tenantA, 'UOM')).toBe(2);
        expect(await repos.codes.next(tenantA, 'CAT')).toBe(1);
        expect(await repos.codes.next(tenantB, 'UOM')).toBe(1);
      });

      // La razon de ser del contador atomico: veinte altas a la vez, veinte numeros.
      it('never hands out the same number to concurrent requests', async () => {
        const issued = await Promise.all(Array.from({ length: 20 }, () => repos.codes.next(tenantA, 'UOM')));

        expect(new Set(issued).size).toBe(20);
        expect(Math.max(...issued)).toBe(20);
      });
    });

    describe('CategoryRepository', () => {
      it('returns what it saved', async () => {
        await repos.categories.save(aCategory());

        const found = await repos.categories.find(tenantA, CategoryId.of(CATEGORY_A));

        expect(found?.toPrimitives()).toEqual(aCategory().toPrimitives());
      });

      it('returns null for a category of another tenant', async () => {
        await repos.categories.save(aCategory({ tenantId: TENANT_B }));

        expect(await repos.categories.find(tenantA, CategoryId.of(CATEGORY_A))).toBeNull();
      });

      it('updates instead of duplicating when saving twice', async () => {
        const category = aCategory();
        await repos.categories.save(category);

        category.update(CategoryName.of('Refrescos'), 'Con gas', LATER);
        category.deactivate(LATER);
        await repos.categories.save(category);

        const all = await repos.categories.searchByTenant(tenantA);
        expect(all).toHaveLength(1);
        expect(all[0].toPrimitives()).toMatchObject({ name: 'Refrescos', description: 'Con gas', isActive: false });
      });

      it('finds by exact name within the tenant', async () => {
        await repos.categories.save(aCategory({ name: 'Bebidas' }));

        expect(await repos.categories.findByName(tenantA, CategoryName.of('Bebidas'))).not.toBeNull();
        expect(await repos.categories.findByName(tenantB, CategoryName.of('Bebidas'))).toBeNull();
      });

      it('lists the categories of the tenant sorted by name', async () => {
        await repos.categories.save(aCategory({ name: 'Limpieza' }));
        await repos.categories.save(aCategory({ id: CATEGORY_B, code: 'CAT000002', name: 'Bebidas' }));
        await repos.categories.save(aCategory({ id: 'c3333333-3333-4333-8333-333333333333', tenantId: TENANT_B }));

        const names = (await repos.categories.searchByTenant(tenantA)).map((c) => c.toPrimitives().name);
        expect(names).toEqual(['Bebidas', 'Limpieza']);
      });

      // Lo que la comprobacion previa no cubre: dos altas simultaneas con el mismo nombre.
      it('refuses a repeated name with the domain error, not a database error', async () => {
        await repos.categories.save(aCategory({ name: 'Bebidas' }));

        await expect(
          repos.categories.save(aCategory({ id: CATEGORY_B, code: 'CAT000002', name: 'Bebidas' })),
        ).rejects.toThrow(DuplicateCategoryNameError);
      });

      // El correlativo es unico por empresa; otra empresa puede tener su CAT000001.
      it('refuses a repeated code in the tenant but not in another one', async () => {
        await repos.categories.save(aCategory({ code: 'CAT000001' }));

        await expect(
          repos.categories.save(aCategory({ id: CATEGORY_B, code: 'CAT000001', name: 'Limpieza' })),
        ).rejects.toThrow();
        await repos.categories.save(aCategory({ id: CATEGORY_B, tenantId: TENANT_B, code: 'CAT000001' }));

        expect(await repos.categories.searchByTenant(tenantB)).toHaveLength(1);
      });

      it('accepts the same name in another tenant', async () => {
        await repos.categories.save(aCategory({ name: 'Bebidas' }));
        await repos.categories.save(aCategory({ id: CATEGORY_B, tenantId: TENANT_B, name: 'Bebidas' }));

        expect(await repos.categories.searchByTenant(tenantB)).toHaveLength(1);
      });
    });

    describe('MeasurementUnitRepository', () => {
      it('returns what it saved', async () => {
        await repos.units.save(aUnit());

        expect((await repos.units.find(tenantA, MeasurementUnitId.of(UNIT_PIECE)))?.toPrimitives()).toEqual(
          aUnit().toPrimitives(),
        );
      });

      it('finds by name and by abbreviation', async () => {
        await repos.units.save(aUnit());

        expect(await repos.units.findByName(tenantA, MeasurementUnitName.of('Unidad'))).not.toBeNull();
        expect(await repos.units.findByAbbreviation(tenantA, UnitAbbreviation.of('un'))).not.toBeNull();
        expect(await repos.units.findByAbbreviation(tenantB, UnitAbbreviation.of('un'))).toBeNull();
      });

      it('searches by ids without crossing tenants', async () => {
        await repos.units.save(aUnit());
        await repos.units.save(aUnit({ id: UNIT_KILO, tenantId: TENANT_B, name: 'Kilogramo', abbreviation: 'kg' }));

        const found = await repos.units.searchByIds(tenantA, [MeasurementUnitId.of(UNIT_PIECE), MeasurementUnitId.of(UNIT_KILO)]);

        expect(found.map((unit) => unit.id.value)).toEqual([UNIT_PIECE]);
        expect(await repos.units.searchByIds(tenantA, [])).toEqual([]);
      });

      it('refuses a repeated name', async () => {
        await repos.units.save(aUnit());

        await expect(repos.units.save(aUnit({ id: UNIT_BOX, code: 'UOM000002', abbreviation: 'ud' }))).rejects.toThrow(
          DuplicateMeasurementUnitNameError,
        );
      });

      it('refuses a repeated abbreviation', async () => {
        await repos.units.save(aUnit());

        await expect(repos.units.save(aUnit({ id: UNIT_BOX, code: 'UOM000002', name: 'Pieza' }))).rejects.toThrow(
          DuplicateMeasurementUnitAbbreviationError,
        );
      });
    });

    describe('TaxRepository', () => {
      // El decimal de la base vuelve como el mismo numero, sin redondeos.
      it('keeps a rate with four decimals exactly', async () => {
        await repos.taxes.save(aTax({ rate: 12.3456 }));

        expect((await repos.taxes.find(tenantA, TaxId.of(TAX_A)))?.toPrimitives().rate).toBe(12.3456);
      });

      it('keeps a zero rate', async () => {
        await repos.taxes.save(aTax({ rate: 0 }));

        expect((await repos.taxes.find(tenantA, TaxId.of(TAX_A)))?.toPrimitives().rate).toBe(0);
      });

      it('updates the rate', async () => {
        const tax = aTax({ rate: 16 });
        await repos.taxes.save(tax);

        tax.update(TaxName.of('IVA 15%'), TaxRate.of(15), LATER);
        await repos.taxes.save(tax);

        expect((await repos.taxes.searchByTenant(tenantA)).map((t) => t.toPrimitives().rate)).toEqual([15]);
      });

      it('refuses a repeated name', async () => {
        await repos.taxes.save(aTax());

        await expect(repos.taxes.save(aTax({ id: TAX_B, code: 'IMP000002' }))).rejects.toThrow(DuplicateTaxNameError);
      });

      it('returns null for a tax of another tenant', async () => {
        await repos.taxes.save(aTax({ tenantId: TENANT_B }));

        expect(await repos.taxes.find(tenantA, TaxId.of(TAX_A))).toBeNull();
        expect(await repos.taxes.findByName(tenantA, TaxName.of('IVA 16%'))).toBeNull();
      });
    });

    describe('WarehouseRepository', () => {
      it('returns what it saved, address and default mark included', async () => {
        const warehouse = aWarehouse({ isDefault: true });
        warehouse.update(WarehouseName.of('Principal'), 'Av. Principal 1', LATER);
        await repos.warehouses.save(warehouse);

        expect((await repos.warehouses.find(tenantA, WarehouseId.of(WAREHOUSE_A)))?.toPrimitives()).toEqual(
          warehouse.toPrimitives(),
        );
      });

      it('finds the default warehouse of each tenant', async () => {
        await repos.warehouses.save(aWarehouse({ isDefault: true }));
        await repos.warehouses.save(aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte' }));

        expect((await repos.warehouses.findDefault(tenantA))?.id.value).toBe(WAREHOUSE_A);
        expect(await repos.warehouses.findDefault(tenantB)).toBeNull();
      });

      it('moves the default mark in one write', async () => {
        const principal = aWarehouse({ isDefault: true });
        const norte = aWarehouse({ id: WAREHOUSE_B, name: 'Norte', code: 'BOD000002' });
        await repos.warehouses.save(principal);
        await repos.warehouses.save(norte);

        principal.unmarkAsDefault(LATER);
        norte.markAsDefault(LATER);
        await repos.warehouses.saveAll([principal, norte]);

        const defaults = (await repos.warehouses.searchByTenant(tenantA)).filter((w) => w.isDefault());
        expect(defaults.map((w) => w.id.value)).toEqual([WAREHOUSE_B]);
      });

      // Todo o nada: si una de las filas choca, tampoco se escribe la otra.
      it('writes nothing when one of the warehouses clashes', async () => {
        await repos.warehouses.save(aWarehouse({ isDefault: true }));
        const clashing = aWarehouse({ id: WAREHOUSE_B, name: 'Principal', code: 'BOD000002' });
        const other = aWarehouse({ id: 'b3333333-3333-4333-8333-333333333333', name: 'Sur', code: 'BOD000003' });

        await expect(repos.warehouses.saveAll([other, clashing])).rejects.toThrow(DuplicateWarehouseNameError);

        expect(await repos.warehouses.searchByTenant(tenantA)).toHaveLength(1);
      });

      // Lo que la comprobacion del dominio no cubre: dos bodegas marcadas a la vez.
      it('refuses a second default warehouse in the same tenant', async () => {
        await repos.warehouses.save(aWarehouse({ isDefault: true }));

        await expect(
          repos.warehouses.save(aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte', isDefault: true })),
        ).rejects.toThrow(ConcurrentDefaultWarehouseError);
        await repos.warehouses.save(aWarehouse({ id: WAREHOUSE_B, tenantId: TENANT_B, isDefault: true }));

        expect((await repos.warehouses.findDefault(tenantA))?.id.value).toBe(WAREHOUSE_A);
      });

      it('finds by name within the tenant', async () => {
        await repos.warehouses.save(aWarehouse());

        expect(await repos.warehouses.findByName(tenantA, WarehouseName.of('Principal'))).not.toBeNull();
        expect(await repos.warehouses.findByName(tenantB, WarehouseName.of('Principal'))).toBeNull();
      });
    });

    describe('ItemUsage', () => {
      it('answers whether an active item uses a category, a tax or a unit, secondary units included', async () => {
        await seedReferences();
        await items.add({ categoryId: CATEGORY_A, taxId: TAX_A, unitIds: [UNIT_PIECE, UNIT_BOX] });

        expect(await repos.itemUsage.activeItemUsesCategory(tenantA, CategoryId.of(CATEGORY_A))).toBe(true);
        expect(await repos.itemUsage.activeItemUsesTax(tenantA, TaxId.of(TAX_A))).toBe(true);
        expect(await repos.itemUsage.activeItemUsesUnit(tenantA, MeasurementUnitId.of(UNIT_BOX))).toBe(true);
        expect(await repos.itemUsage.activeItemUsesCategory(tenantB, CategoryId.of(CATEGORY_A))).toBe(false);
      });

      it('does not count inactive items as using anything', async () => {
        await seedReferences();
        await items.add({ categoryId: CATEGORY_A, taxId: TAX_A, unitIds: [UNIT_PIECE], isActive: false });

        expect(await repos.itemUsage.activeItemUsesCategory(tenantA, CategoryId.of(CATEGORY_A))).toBe(false);
        expect(await repos.itemUsage.activeItemUsesTax(tenantA, TaxId.of(TAX_A))).toBe(false);
        expect(await repos.itemUsage.activeItemUsesUnit(tenantA, MeasurementUnitId.of(UNIT_PIECE))).toBe(false);
      });

      it('does not count what an item does not use', async () => {
        await seedReferences();
        await items.add({ unitIds: [UNIT_BOX] });

        expect(await repos.itemUsage.activeItemUsesCategory(tenantA, CategoryId.of(CATEGORY_A))).toBe(false);
        expect(await repos.itemUsage.activeItemUsesTax(tenantA, TaxId.of(TAX_A))).toBe(false);
        expect(await repos.itemUsage.activeItemUsesUnit(tenantA, MeasurementUnitId.of(UNIT_PIECE))).toBe(false);
      });
    });
  });
}
