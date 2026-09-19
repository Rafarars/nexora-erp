import { describe, expect, it } from 'vitest';
import { DuplicateCustomerNameError, InvalidCustomerEmailError, CustomerNotFoundError } from '../domain/errors/sales.errors.js';
import { TENANT_A, TENANT_B } from '../domain/testing/sales.mother.js';
import { aSalesScenario } from './testing/sales-scenario.js';

async function withCustomer(name = 'Comercial Delta') {
  const s = aSalesScenario();
  await s.createCustomer.run({ tenantId: TENANT_A, name, fiscalId: 'J-12345678-9', paymentTermDays: 30 });
  const [customer] = (await s.searchCustomers.run({ tenantId: TENANT_A })).customers;

  return { s, customer };
}

describe('customers', () => {
  it('creates a customer with its code and lists it by name', async () => {
    const { s } = await withCustomer();
    await s.createCustomer.run({ tenantId: TENANT_A, name: 'Bodegón La Esquina' });

    const { customers } = await s.searchCustomers.run({ tenantId: TENANT_A });

    expect(customers).toMatchObject([
      { code: 'CLI000002', name: 'Bodegón La Esquina', paymentTermDays: 0, isActive: true },
      { code: 'CLI000001', name: 'Comercial Delta', fiscalId: 'J-12345678-9', paymentTermDays: 30 },
    ]);
  });

  it('refuses a name that another customer of the same tenant has, but not one of another tenant', async () => {
    const { s } = await withCustomer();

    await expect(s.createCustomer.run({ tenantId: TENANT_A, name: 'Comercial Delta' })).rejects.toThrow(DuplicateCustomerNameError);
    await expect(s.createCustomer.run({ tenantId: TENANT_B, name: 'Comercial Delta' })).resolves.toBeUndefined();
  });

  it('does not consume a code when the customer is invalid', async () => {
    const { s } = await withCustomer();

    await expect(s.createCustomer.run({ tenantId: TENANT_A, name: 'Otro', email: 'sin-arroba' })).rejects.toThrow(InvalidCustomerEmailError);
    await s.createCustomer.run({ tenantId: TENANT_A, name: 'Otro' });

    expect((await s.searchCustomers.run({ tenantId: TENANT_A })).customers.map((x) => x.code)).toContain('CLI000002');
  });

  it('edits a customer, keeping its own name free for itself', async () => {
    const { s, customer } = await withCustomer();

    await s.updateCustomer.run({ tenantId: TENANT_A, customerId: customer.id, name: 'Comercial Delta', email: 'ventas@andina.com' });

    expect((await s.searchCustomers.run({ tenantId: TENANT_A })).customers[0]).toMatchObject({ email: 'ventas@andina.com', fiscalId: null });
  });

  it('deactivates and reactivates a customer', async () => {
    const { s, customer } = await withCustomer();

    await s.changeCustomerStatus.run({ tenantId: TENANT_A, customerId: customer.id, active: false });
    expect((await s.searchCustomers.run({ tenantId: TENANT_A })).customers[0].isActive).toBe(false);

    await s.changeCustomerStatus.run({ tenantId: TENANT_A, customerId: customer.id, active: true });
    expect((await s.searchCustomers.run({ tenantId: TENANT_A })).customers[0].isActive).toBe(true);
  });

  it('searches by code, name and fiscal id, and pages the result', async () => {
    const { s } = await withCustomer();
    await s.createCustomer.run({ tenantId: TENANT_A, name: 'Bodegón La Esquina' });
    await s.createCustomer.run({ tenantId: TENANT_A, name: 'Aguas del Valle' });

    expect((await s.searchCustomers.run({ tenantId: TENANT_A, q: 'aguas' })).customers.map((c) => c.name)).toEqual(['Aguas del Valle']);
    expect((await s.searchCustomers.run({ tenantId: TENANT_A, q: 'J-12345678' })).customers.map((c) => c.name)).toEqual(['Comercial Delta']);
    expect((await s.searchCustomers.run({ tenantId: TENANT_A, q: 'cli000002' })).customers.map((c) => c.name)).toEqual(['Bodegón La Esquina']);

    expect(await s.searchCustomers.run({ tenantId: TENANT_A, limit: 2 })).toMatchObject({ total: 3, limit: 2, offset: 0, hasMore: true });
    expect(await s.searchCustomers.run({ tenantId: TENANT_A, limit: 2, offset: 2 })).toMatchObject({ total: 3, hasMore: false });
  });

  it('filters the list by whether the customer is active', async () => {
    const { s, customer } = await withCustomer();
    await s.createCustomer.run({ tenantId: TENANT_A, name: 'Bodegón La Esquina' });
    await s.changeCustomerStatus.run({ tenantId: TENANT_A, customerId: customer.id, active: false });

    expect((await s.searchCustomers.run({ tenantId: TENANT_A, active: 'false' })).customers.map((c) => c.name)).toEqual(['Comercial Delta']);
    expect((await s.searchCustomers.run({ tenantId: TENANT_A, active: 'true' })).customers.map((c) => c.name)).toEqual(['Bodegón La Esquina']);
  });

  it('cannot reach the customer of another tenant', async () => {
    const { s, customer } = await withCustomer();

    await expect(s.updateCustomer.run({ tenantId: TENANT_B, customerId: customer.id, name: 'Robado' })).rejects.toThrow(CustomerNotFoundError);
    await expect(s.changeCustomerStatus.run({ tenantId: TENANT_B, customerId: customer.id, active: false })).rejects.toThrow(
      CustomerNotFoundError,
    );
    expect((await s.searchCustomers.run({ tenantId: TENANT_B })).customers).toEqual([]);
  });
});
