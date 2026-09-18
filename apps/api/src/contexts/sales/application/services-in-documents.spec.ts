import { describe, expect, it } from 'vitest';
import { OrderNotDirectlyInvoiceableError } from '../domain/errors/sales.errors.js';
import { MAIN, PIECE, SERVICE, TENANT_A, WATER } from '../domain/testing/sales.mother.js';
import { SalesScenario, aSalesScenario } from './testing/sales-scenario.js';

// Un servicio se vende, pero no sale de una bodega: su linea no reserva, no se despacha y no deja
// el pedido abierto para siempre. A la factura entra igual que un tornillo.
async function world() {
  const s = aSalesScenario();
  await s.createCustomer.run({ tenantId: TENANT_A, name: 'Comercial Delta' });
  const [{ id: customerId }] = (await s.searchCustomers.run({ tenantId: TENANT_A })).customers;
  s.store.stock(TENANT_A, WATER, MAIN, 480);

  return { s, customerId };
}

const latestOrder = async (s: SalesScenario) => (await s.searchOrders.run({ tenantId: TENANT_A })).orders[0];
const latestInvoice = async (s: SalesScenario) => (await s.searchInvoices.run({ tenantId: TENANT_A })).invoices[0];

describe('a service in a sales order', () => {
  it('can be sold, and its line does not reserve stock', async () => {
    const { s, customerId } = await world();

    await s.createOrder.run({
      tenantId: TENANT_A,
      customerId,
      warehouseId: MAIN,
      lines: [{ itemId: SERVICE, unitId: PIECE, quantity: 1, unitPrice: 25 }],
    });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

    // Nace despachado: no hay nada que sacar de la bodega, así que no espera un despacho que nunca
    // va a existir. Es el defecto que ERPNext tiene documentado y que el compañero evita.
    expect((await latestOrder(s)).status).toBe('dispatched');
  });

  it('is invoiced straight from the order when the order sells nothing else', async () => {
    const { s, customerId } = await world();

    await s.createOrder.run({
      tenantId: TENANT_A,
      customerId,
      warehouseId: MAIN,
      lines: [{ itemId: SERVICE, unitId: PIECE, quantity: 2, unitPrice: 25 }],
    });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

    await s.issueInvoice.run({ tenantId: TENANT_A, orderId: order.id });

    const invoice = await latestInvoice(s);
    expect(invoice.dispatch).toBeNull();
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({ quantity: 2, unitPrice: 25 });
  });

  // Facturar dos veces el mismo servicio cobraria de mas al cliente.
  it('cannot be invoiced twice from the same order', async () => {
    const { s, customerId } = await world();

    await s.createOrder.run({
      tenantId: TENANT_A,
      customerId,
      warehouseId: MAIN,
      lines: [{ itemId: SERVICE, unitId: PIECE, quantity: 1, unitPrice: 25 }],
    });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });
    await s.issueInvoice.run({ tenantId: TENANT_A, orderId: order.id });

    await expect(s.issueInvoice.run({ tenantId: TENANT_A, orderId: order.id })).rejects.toThrow();
  });

  // Un pedido con mercancia se factura desde su despacho: es lo que dice que salio de verdad.
  it('refuses to invoice an order with goods without its dispatch', async () => {
    const { s, customerId } = await world();

    await s.createOrder.run({
      tenantId: TENANT_A,
      customerId,
      warehouseId: MAIN,
      lines: [{ itemId: WATER, unitId: PIECE, quantity: 10, unitPrice: 1 }],
    });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

    await expect(s.issueInvoice.run({ tenantId: TENANT_A, orderId: order.id })).rejects.toThrow(
      OrderNotDirectlyInvoiceableError,
    );
  });
});

describe('an order that mixes goods and a service', () => {
  it('dispatches only the goods, and the invoice charges both', async () => {
    const { s, customerId } = await world();

    await s.createOrder.run({
      tenantId: TENANT_A,
      customerId,
      warehouseId: MAIN,
      lines: [
        { itemId: WATER, unitId: PIECE, quantity: 10, unitPrice: 1 },
        { itemId: SERVICE, unitId: PIECE, quantity: 1, unitPrice: 25 },
      ],
    });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

    const goods = order.lines.find((line) => line.itemId === WATER)!;
    await s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: goods.id, quantity: 10 }] });
    const [dispatch] = (await s.searchDispatches.run({ tenantId: TENANT_A })).dispatches;

    // El despacho solo puede llevar la mercancia: el servicio no sale de la bodega.
    expect(dispatch.lines).toHaveLength(1);

    await s.confirmDispatch.run({ tenantId: TENANT_A, dispatchId: dispatch.id });
    await s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: dispatch.id });

    // La factura del despacho arrastra el servicio del pedido: si no, no se cobraria nunca.
    const invoice = await latestInvoice(s);
    expect(invoice.lines).toHaveLength(2);
    // 10 unidades a 1 y el servicio a 25, ambos con 16 %: 11,60 + 29,00.
    expect(invoice.total).toBe(40.6);

    // Y el pedido queda despachado del todo: el servicio no lo deja abierto.
    expect((await latestOrder(s)).status).toBe('dispatched');
  });
});
