import { describe, expect, it } from 'vitest';
import {
  DuplicatePriceListNameError,
  UnknownPriceListCurrencyError,
} from '../../domain/errors/price-list.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, aPriceList } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { PriceListCreator } from './price-list-creator.js';

const creatorFor = (s: CatalogScenario) =>
  new PriceListCreator(s.defaultPriceList, s.priceListUniqueness, s.priceListCurrency, s.codes, s.ids, s.clock);
const listed = async (s: CatalogScenario) =>
  (await s.priceLists.searchByTenant(TenantId.of(TENANT_A))).map((priceList) => priceList.toPrimitives());

describe('PriceListCreator', () => {
  it('makes the first price list of the tenant the default one', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Mayorista', currency: 'USD' });

    expect(await listed(scenario)).toMatchObject([
      { code: 'LPR000001', name: 'Mayorista', currency: 'USD', isDefault: true, isActive: true },
    ]);
  });

  it('creates the next ones without taking the mark', async () => {
    const scenario = aCatalogScenario({ priceLists: [aPriceList({ isDefault: true, code: 'LPR000100' })] });

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Detal', currency: 'USD' });

    const detal = (await listed(scenario)).find((priceList) => priceList.name === 'Detal');
    expect(detal?.isDefault).toBe(false);
  });

  it('writes the currency in upper case', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Mayorista', currency: 'usd' });

    expect((await listed(scenario))[0].currency).toBe('USD');
  });

  it('rejects a repeated name', async () => {
    const scenario = aCatalogScenario({ priceLists: [aPriceList()] });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Mayorista', currency: 'USD' })).rejects.toThrow(
      DuplicatePriceListNameError,
    );
  });

  // Sin moneda usable no habria tasa con la que convertir sus precios al documento.
  it('rejects a currency that does not exist', async () => {
    const scenario = aCatalogScenario();

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Mayorista', currency: 'XYZ' })).rejects.toThrow(
      UnknownPriceListCurrencyError,
    );
  });

  // Una moneda retirada del catalogo existe, pero ya no se cotiza en ella: no es lo mismo que una
  // que nunca existio, y el adaptador tiene que distinguirlo.
  it('rejects a currency that exists but was deactivated', async () => {
    const scenario = aCatalogScenario({
      currencies: [
        { code: 'USD', isActive: true },
        { code: 'EUR', isActive: false },
      ],
    });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Europa', currency: 'EUR' })).rejects.toThrow(
      UnknownPriceListCurrencyError,
    );
  });
});
