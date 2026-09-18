import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ItemCommitments } from '../domain/item/commitments/item-commitments.js';
import { DuplicateSkuError, ItemNotFoundError } from '../domain/errors/item.errors.js';
import { Barcode } from '../domain/item/barcode.vo.js';
import { ItemId } from '../domain/item/item-id.vo.js';
import { ItemName } from '../domain/item/item-name.vo.js';
import { ItemUnit, ItemUnits } from '../domain/item/item-units.js';
import { Sku } from '../domain/item/sku.vo.js';
import { CategoryRef, TaxRef, UnitRef } from '../domain/shared/references.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import {
  CATEGORY_A,
  CATEGORY_B,
  ITEM_A,
  ITEM_B,
  LATER,
  TAX_A,
  TAX_B,
  TENANT_A,
  TENANT_B,
  UNIT_BOX,
  UNIT_KILO,
  UNIT_PIECE,
  aCategory,
  aTax,
  aUnit,
  anItem,
  baseUnitOnly,
} from '../domain/testing/item.mother.js';
import { CatalogSeeder, ItemCommitmentsSeeder, ItemPorts, ItemPortsHarness } from './item-ports.harness.js';

const tenantA = TenantId.of(TENANT_A);
const tenantB = TenantId.of(TENANT_B);

// UNA suite ejecutada dos veces: contra los dobles en memoria y contra PostgreSQL. Si las dos
// pasan, los dobles de las pruebas de aplicacion no mienten sobre la base.
// Todo el maestro, sin filtro.
const ALL = { text: null, limit: 100, offset: 0 };

export function describeItemPortsContract(implementation: string, createHarness: () => ItemPortsHarness): void {
  describe(`Item ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: ItemPorts;
    let catalog: CatalogSeeder;
    let seed: ItemCommitmentsSeeder;

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
      catalog = harness.catalog();
      seed = harness.commitments();
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
      await catalog.category(aCategory());
      await catalog.tax(aTax());
      await catalog.unit(aUnit());
      await catalog.unit(aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja' }));
    }

    describe('ItemRepository', () => {
      it('returns what it saved, units and fractional factors included', async () => {
        await seedReferences();
        const item = anItem({
          units: ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, 0.08333333, false)]),
        });

        await ports.items.save(item);

        const found = await ports.items.find(tenantA, ItemId.of(ITEM_A));
        expect(found?.toPrimitives()).toEqual(item.toPrimitives());
      });

      it('saves an item with no category and no taxes', async () => {
        await seedReferences();
        await ports.items.save(anItem({ categoryId: null, salesTaxId: null, purchaseTaxId: null }));

        expect((await ports.items.find(tenantA, ItemId.of(ITEM_A)))?.toPrimitives()).toMatchObject({
          categoryId: null,
          salesTaxId: null,
          purchaseTaxId: null,
        });
      });

      // El lector de la caja busca por el codigo impreso, y nunca encuentra el de otra empresa.
      it('finds an item by its barcode, only within its tenant', async () => {
        await seedReferences();
        await ports.items.save(anItem({ barcode: '7591234567890' }));

        expect((await ports.items.findByBarcode(tenantA, Barcode.of('7591234567890')))?.id.value).toBe(ITEM_A);
        expect(await ports.items.findByBarcode(tenantA, Barcode.of('0000000000000'))).toBeNull();
        expect(await ports.items.findByBarcode(TenantId.of(TENANT_B), Barcode.of('7591234567890'))).toBeNull();
      });

      // Vender con IVA lo que se compra exento: son dos impuestos distintos.
      it('saves a different tax for selling and for buying', async () => {
        await seedReferences();
        await catalog.tax(aTax({ id: TAX_B, name: 'Exento', rate: 0 }));
        await ports.items.save(anItem({ salesTaxId: TAX_A, purchaseTaxId: TAX_B }));

        expect((await ports.items.find(tenantA, ItemId.of(ITEM_A)))?.toPrimitives()).toMatchObject({ salesTaxId: TAX_A, purchaseTaxId: TAX_B });
      });

      // Las unidades se reemplazan enteras: la caja retirada no puede quedar colgando.
      it('replaces the units on update', async () => {
        await seedReferences();
        const item = anItem({
          units: ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, 24, false)]),
        });
        await ports.items.save(item);

        item.update({ ...detailsOf(item), units: baseUnitOnly(UNIT_BOX) }, LATER);
        await ports.items.save(item);

        expect((await ports.items.find(tenantA, ItemId.of(ITEM_A)))?.toPrimitives().units).toEqual([
          { unitId: UNIT_BOX, conversionFactor: 1, isBase: true },
        ]);
      });

      it('finds by SKU within the tenant', async () => {
        await seedReferences();
        await ports.items.save(anItem({ sku: 'AGUA-500' }));

        expect(await ports.items.findBySku(tenantA, Sku.of('agua-500'))).not.toBeNull();
        expect(await ports.items.findBySku(tenantB, Sku.of('AGUA-500'))).toBeNull();
      });

      it('refuses a repeated SKU and keeps the first item intact', async () => {
        await seedReferences();
        await ports.items.save(anItem({ sku: 'AGUA-500' }));

        await expect(
          ports.items.save(anItem({ id: ITEM_B, code: 'ART000002', sku: 'AGUA-500', units: baseUnitOnly(UNIT_BOX) })),
        ).rejects.toThrow(DuplicateSkuError);

        const { items } = await ports.items.search(tenantA, ALL);
        expect(items.map((item) => item.toPrimitives().units)).toEqual([[{ unitId: UNIT_PIECE, conversionFactor: 1, isBase: true }]]);
      });

      it('lists only the items of the tenant', async () => {
        await seedReferences();
        await ports.items.save(anItem());

        expect((await ports.items.search(tenantA, ALL)).items).toHaveLength(1);
        expect(await ports.items.search(tenantB, ALL)).toEqual({ items: [], total: 0 });
      });

      // El listado se pide por paginas y se filtra por texto: codigo, SKU, nombre o codigo de barras.
      it('pages the master and filters it by text', async () => {
        await seedReferences();
        await ports.items.save(anItem({ sku: 'AGUA-500', name: 'Agua mineral', barcode: '7591234567890' }));
        await ports.items.save(anItem({ id: ITEM_B, code: 'ART000002', sku: 'JABON-1KG', name: 'Jabón azul', units: baseUnitOnly(UNIT_BOX) }));

        const page = await ports.items.search(tenantA, { text: null, limit: 1, offset: 0 });

        expect(page.total).toBe(2);
        expect(page.items.map((item) => item.sku().value)).toEqual(['AGUA-500']);
        expect((await ports.items.search(tenantA, { text: null, limit: 1, offset: 1 })).items.map((item) => item.sku().value)).toEqual(['JABON-1KG']);
        expect((await ports.items.search(tenantA, { text: 'jab', limit: 10, offset: 0 })).items.map((item) => item.sku().value)).toEqual(['JABON-1KG']);
        expect((await ports.items.search(tenantA, { text: '75912', limit: 10, offset: 0 })).items.map((item) => item.sku().value)).toEqual(['AGUA-500']);
        expect((await ports.items.search(tenantA, { text: 'nada', limit: 10, offset: 0 })).total).toBe(0);
      });
    });

    describe('ItemPosting', () => {
      const itemA = ItemId.of(ITEM_A);

      // Un articulo con caja de 24; lo comprometido se siembra en la bodega A.
      async function seedItem(): Promise<void> {
        await seedReferences();
        await ports.items.save(anItem({ units: ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, 24, false)]) }));
      }

      async function commitmentsOf(): Promise<ItemCommitments> {
        let seen: ItemCommitments | undefined;

        await ports.posting.post(tenantA, itemA, (_item, commitments) => {
          seen = commitments;
        });

        return seen!;
      }

      const openUnits = async () => (await commitmentsOf()).openDocumentUnits.map((unit) => unit.value);

      it('hands the work the item and saves what it leaves', async () => {
        await seedItem();

        await ports.posting.post(tenantA, itemA, (item) => item.deactivate(LATER));

        expect((await ports.items.find(tenantA, itemA))?.isActive()).toBe(false);
        expect(await commitmentsOf()).toEqual({ hasStock: false, hasMovements: false, openDocumentUnits: [] });
      });

      it('writes nothing when the work throws', async () => {
        await seedItem();

        await expect(
          ports.posting.post(tenantA, itemA, (item) => {
            item.deactivate(LATER);
            throw new Error('rule broken');
          }),
        ).rejects.toThrow('rule broken');

        expect((await ports.items.find(tenantA, itemA))?.isActive()).toBe(true);
      });

      it('does not reach an item of another tenant', async () => {
        await seedItem();

        await expect(ports.posting.post(tenantB, itemA, () => undefined)).rejects.toThrow(ItemNotFoundError);
      });

      it('counts stock only when a warehouse holds a positive quantity', async () => {
        await seedItem();
        await seed.stock(ITEM_A, 0);
        expect((await commitmentsOf()).hasStock).toBe(false);

        await seed.stock(ITEM_A, 5);
        expect((await commitmentsOf()).hasStock).toBe(true);
      });

      it('knows whether the item has inventory movements', async () => {
        await seedItem();
        expect((await commitmentsOf()).hasMovements).toBe(false);

        await seed.movement(ITEM_A);
        expect((await commitmentsOf()).hasMovements).toBe(true);
      });

      // Solo lo que todavia promete algo: confirmada o recibida en parte, y con pendiente en la linea.
      it('reports the units of purchase order lines still pending', async () => {
        await seedItem();
        await seed.purchaseLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'draft', quantity: 5, received: 0 });
        await seed.purchaseLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'received', quantity: 5, received: 5 });
        await seed.purchaseLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'cancelled', quantity: 5, received: 0 });
        await seed.purchaseLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'partially_received', quantity: 5, received: 5 });
        expect(await openUnits()).toEqual([]);

        await seed.purchaseLine({ itemId: ITEM_A, unitId: UNIT_BOX, status: 'confirmed', quantity: 10, received: 0 });
        await seed.purchaseLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'partially_received', quantity: 5, received: 2 });
        expect(await openUnits()).toEqual([UNIT_PIECE, UNIT_BOX]);
      });

      it('reports the units of sales order lines still pending, each unit once', async () => {
        await seedItem();
        await seed.salesLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'draft', quantity: 5, dispatched: 0 });
        await seed.salesLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'dispatched', quantity: 5, dispatched: 5 });
        await seed.salesLine({ itemId: ITEM_A, unitId: UNIT_PIECE, status: 'cancelled', quantity: 5, dispatched: 0 });
        expect(await openUnits()).toEqual([]);

        await seed.salesLine({ itemId: ITEM_A, unitId: UNIT_BOX, status: 'confirmed', quantity: 2, dispatched: 0 });
        await seed.salesLine({ itemId: ITEM_A, unitId: UNIT_BOX, status: 'partially_dispatched', quantity: 4, dispatched: 1 });
        expect(await openUnits()).toEqual([UNIT_BOX]);
      });
    });

    describe('CatalogReferences', () => {
      it('finds what the item uses, with its names and status', async () => {
        await catalog.category(aCategory({ active: false }));
        await catalog.tax(aTax({ rate: 12.5 }));
        await catalog.unit(aUnit());

        expect(await ports.catalog.findCategories(tenantA, [CategoryRef.of(CATEGORY_A)])).toEqual([
          { id: CATEGORY_A, name: 'Bebidas', isActive: false },
        ]);
        expect(await ports.catalog.findTaxes(tenantA, [TaxRef.of(TAX_A)])).toEqual([
          { id: TAX_A, name: 'IVA 16%', rate: 12.5, isActive: true },
        ]);
        expect(await ports.catalog.findUnits(tenantA, [UnitRef.of(UNIT_PIECE)])).toEqual([
          { id: UNIT_PIECE, name: 'Unidad', abbreviation: 'un', isActive: true },
        ]);
      });

      // Aislamiento: lo de otra empresa no aparece, y lo que no existe tampoco.
      it('leaves out what belongs to another tenant or does not exist', async () => {
        await catalog.category(aCategory({ tenantId: TENANT_B }));
        await catalog.unit(aUnit());
        await catalog.unit(aUnit({ id: UNIT_KILO, tenantId: TENANT_B, name: 'Kilogramo', abbreviation: 'kg' }));

        expect(await ports.catalog.findCategories(tenantA, [CategoryRef.of(CATEGORY_A), CategoryRef.of(CATEGORY_B)])).toEqual([]);
        expect((await ports.catalog.findUnits(tenantA, [UnitRef.of(UNIT_PIECE), UnitRef.of(UNIT_KILO)])).map((unit) => unit.id)).toEqual([
          UNIT_PIECE,
        ]);
        expect(await ports.catalog.findTaxes(tenantA, [])).toEqual([]);
      });
    });
  });
}

function detailsOf(item: ReturnType<typeof anItem>) {
  const row = item.toPrimitives();

  return {
    sku: Sku.of(row.sku),
    name: ItemName.of(row.name),
    description: row.description,
    type: row.type,
    categoryId: row.categoryId ? CategoryRef.of(row.categoryId) : null,
    barcode: row.barcode ? Barcode.of(row.barcode) : null,
    isPurchasable: row.isPurchasable,
    isSellable: row.isSellable,
    salesTaxId: row.salesTaxId ? TaxRef.of(row.salesTaxId) : null,
    purchaseTaxId: row.purchaseTaxId ? TaxRef.of(row.purchaseTaxId) : null,
    units: ItemUnits.fromPrimitives(row.units),
  };
}
