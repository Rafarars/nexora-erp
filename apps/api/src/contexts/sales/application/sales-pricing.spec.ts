import { describe, expect, it } from 'vitest';
import {
  InactivePriceListError,
  MissingSalesPriceError,
  PriceListNotFoundError,
  SalesPriceBelowMinimumError,
} from '../domain/errors/sales.errors.js';
import {
  BOX,
  CLOSED_LIST,
  EURO_LIST,
  KILO,
  MAIN,
  PIECE,
  RETAIL_LIST,
  SOAP,
  TENANT_A,
  WATER,
  WHOLESALE_LIST,
} from '../domain/testing/sales.mother.js';
import { SalesOrderCreatorRequest } from './create-order/sales-order-creator.js';
import { SalesScenario, aSalesScenario } from './testing/sales-scenario.js';

// El precio de una linea sale de la lista con la que se cotiza: la del pedido, la del cliente o la
// de por defecto. El agua vale 0,85 al detal, 0,70 al mayor y 0,80 en la lista en euros; se cuenta
// en piezas y se vende en cajas de 24. El doble de tasas tiene el dolar a 36,50 y el euro a 40.
async function world(customer: { priceListId?: string | null } = {}) {
  const s = aSalesScenario();
  await s.createCustomer.run({ tenantId: TENANT_A, name: 'Comercial Delta', ...customer });
  const [{ id: customerId }] = (await s.searchCustomers.run({ tenantId: TENANT_A })).customers;
  s.store.stock(TENANT_A, WATER, MAIN, 480);

  const order = (overrides: Partial<SalesOrderCreatorRequest> = {}) =>
    s.createOrder.run({
      tenantId: TENANT_A,
      customerId,
      warehouseId: MAIN,
      lines: [{ itemId: WATER, unitId: PIECE, quantity: 10 }],
      ...overrides,
    });

  return { s, order, customerId };
}

const latest = async (s: SalesScenario) => (await s.searchOrders.run({ tenantId: TENANT_A })).orders[0];

describe('the price of a sales order line', () => {
  it('comes from the default price list when neither the order nor the customer chooses one', async () => {
    const { s, order } = await world();

    await order();

    const found = await latest(s);
    expect(found.priceList).toEqual({ id: RETAIL_LIST, name: 'Detal' });
    expect(found.lines[0].unitPrice).toBe(0.85);
  });

  it('comes from the list of the customer when it has one', async () => {
    const { s, order } = await world({ priceListId: WHOLESALE_LIST });

    await order();

    expect((await latest(s)).lines[0].unitPrice).toBe(0.7);
  });

  // La del pedido manda sobre la del cliente: una venta puntual se cotiza distinto.
  it('comes from the list of the order, above the one of the customer', async () => {
    const { s, order } = await world({ priceListId: WHOLESALE_LIST });

    await order({ priceListId: RETAIL_LIST });

    expect((await latest(s)).lines[0].unitPrice).toBe(0.85);
  });

  // Lo que el companero no hace: su precio esta en unidad base y lo sugiere igual en cualquier
  // unidad, asi que vender cajas cobraria el precio de la pieza.
  it('multiplies the base price by the conversion factor of the chosen unit', async () => {
    const { s, order } = await world();

    await order({ lines: [{ itemId: WATER, unitId: BOX, quantity: 2 }] });

    // Una caja de 24 a 0,85 la pieza: 20,40.
    expect((await latest(s)).lines[0].unitPrice).toBe(20.4);
  });

  it('keeps what the person wrote, above the list', async () => {
    const { s, order } = await world();

    await order({ lines: [{ itemId: WATER, unitId: PIECE, quantity: 10, unitPrice: 0.5 }] });

    const line = (await latest(s)).lines[0];
    expect(line.unitPrice).toBe(0.5);
    // El de la lista queda al lado: la diferencia es el descuento que se concedio.
    expect(line.listPrice).toBe(0.85);
  });

  it('converts through the bolivar when the list is in another currency than the order', async () => {
    const { s, order } = await world();

    await order({ priceListId: EURO_LIST, currency: 'USD' });

    // 0,80 EUR a 40 Bs son 32 Bs; a 36,50 Bs por dolar, 0,876712.
    expect((await latest(s)).lines[0].unitPrice).toBe(0.876712);
  });

  it('does not convert when the list is already in the currency of the order', async () => {
    const { s, order } = await world();

    await order({ priceListId: EURO_LIST, currency: 'EUR' });

    expect((await latest(s)).lines[0].unitPrice).toBe(0.8);
  });

  // Sin precio cargado ni escrito, la linea no se puede valorar.
  it('refuses a line with no price in the list and none written', async () => {
    const { order } = await world();

    await expect(order({ lines: [{ itemId: SOAP, unitId: KILO, quantity: 1 }] })).rejects.toThrow(MissingSalesPriceError);
  });

  it('refuses a price list that does not exist or is deactivated', async () => {
    const { order } = await world();

    await expect(order({ priceListId: '00000000-0000-4000-8000-000000000000' })).rejects.toThrow(PriceListNotFoundError);
    await expect(order({ priceListId: CLOSED_LIST })).rejects.toThrow(InactivePriceListError);
  });
});

describe('the minimum price of an item', () => {
  // El piso esta en la moneda de la empresa: el precio de la linea se lleva alli antes de comparar,
  // que es justo lo que el companero no hace.
  it('rejects a written price below it, comparing in the company currency', async () => {
    const { s, order } = await world();
    const water = s.catalog.items.find((item) => item.id === WATER)!;
    water.minPrice = 0.8;

    await expect(order({ lines: [{ itemId: WATER, unitId: PIECE, quantity: 1, unitPrice: 0.5 }] })).rejects.toThrow(
      SalesPriceBelowMinimumError,
    );

    water.minPrice = null;
  });

  it('measures the price of a line in another currency against the same minimum', async () => {
    const { s, order } = await world();
    const water = s.catalog.items.find((item) => item.id === WATER)!;
    water.minPrice = 0.8;

    // 0,80 EUR son 32 Bs, y en dolares 0,876712: por encima del piso de 0,80 USD.
    await expect(order({ lines: [{ itemId: WATER, unitId: PIECE, quantity: 1, unitPrice: 0.8 }], currency: 'EUR' })).resolves.toBeUndefined();

    water.minPrice = null;
  });
});
