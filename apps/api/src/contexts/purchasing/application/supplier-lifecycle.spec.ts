import { describe, expect, it } from 'vitest';
import { DuplicateSupplierNameError, InvalidSupplierEmailError, SupplierNotFoundError } from '../domain/errors/purchasing.errors.js';
import { TENANT_A, TENANT_B } from '../domain/testing/purchasing.mother.js';
import { aPurchasingScenario } from './testing/purchasing-scenario.js';

async function withSupplier(name = 'Distribuidora Andina') {
  const s = aPurchasingScenario();
  await s.createSupplier.run({ tenantId: TENANT_A, name, fiscalId: 'J-12345678-9', paymentTermDays: 30 });
  const [supplier] = (await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers;

  return { s, supplier };
}

describe('suppliers', () => {
  it('creates a supplier with its code and lists it by name', async () => {
    const { s } = await withSupplier();
    await s.createSupplier.run({ tenantId: TENANT_A, name: 'Aguas del Valle' });

    const { suppliers } = await s.searchSuppliers.run({ tenantId: TENANT_A });

    expect(suppliers).toMatchObject([
      { code: 'PRV000002', name: 'Aguas del Valle', paymentTermDays: 0, isActive: true },
      { code: 'PRV000001', name: 'Distribuidora Andina', fiscalId: 'J-12345678-9', paymentTermDays: 30 },
    ]);
  });

  it('refuses a name that another supplier of the same tenant has, but not one of another tenant', async () => {
    const { s } = await withSupplier();

    await expect(s.createSupplier.run({ tenantId: TENANT_A, name: 'Distribuidora Andina' })).rejects.toThrow(DuplicateSupplierNameError);
    await expect(s.createSupplier.run({ tenantId: TENANT_B, name: 'Distribuidora Andina' })).resolves.toBeUndefined();
  });

  it('does not consume a code when the supplier is invalid', async () => {
    const { s } = await withSupplier();

    await expect(s.createSupplier.run({ tenantId: TENANT_A, name: 'Otro', email: 'sin-arroba' })).rejects.toThrow(InvalidSupplierEmailError);
    await s.createSupplier.run({ tenantId: TENANT_A, name: 'Otro' });

    expect((await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers.map((x) => x.code)).toContain('PRV000002');
  });

  it('edits a supplier, keeping its own name free for itself', async () => {
    const { s, supplier } = await withSupplier();

    await s.updateSupplier.run({ tenantId: TENANT_A, supplierId: supplier.id, name: 'Distribuidora Andina', email: 'compras@andina.com' });

    expect((await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers[0]).toMatchObject({ email: 'compras@andina.com', fiscalId: null });
  });

  it('deactivates and reactivates a supplier', async () => {
    const { s, supplier } = await withSupplier();

    await s.changeSupplierStatus.run({ tenantId: TENANT_A, supplierId: supplier.id, active: false });
    expect((await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers[0].isActive).toBe(false);

    await s.changeSupplierStatus.run({ tenantId: TENANT_A, supplierId: supplier.id, active: true });
    expect((await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers[0].isActive).toBe(true);
  });

  it('cannot reach the supplier of another tenant', async () => {
    const { s, supplier } = await withSupplier();

    await expect(s.updateSupplier.run({ tenantId: TENANT_B, supplierId: supplier.id, name: 'Robado' })).rejects.toThrow(SupplierNotFoundError);
    await expect(s.changeSupplierStatus.run({ tenantId: TENANT_B, supplierId: supplier.id, active: false })).rejects.toThrow(
      SupplierNotFoundError,
    );
    expect((await s.searchSuppliers.run({ tenantId: TENANT_B })).suppliers).toEqual([]);
  });
});
