import { describe, expect, it } from 'vitest';
import {
  EmptyPurchasingTextError,
  InvalidPaymentTermError,
  InvalidSupplierEmailError,
  PurchasingTextTooLongError,
} from '../errors/purchasing.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { NOW, SUPPLIER, TENANT_A } from '../testing/purchasing.mother.js';
import { Supplier, SupplierDetails, SupplierId } from './supplier.entity.js';

const create = (details: Partial<SupplierDetails> = {}) =>
  Supplier.create(SupplierId.of(SUPPLIER), TenantId.of(TENANT_A), 'PRV000001', { name: 'Distribuidora Andina', ...details }, NOW);

describe('Supplier', () => {
  it('is born active, trimmed and with no payment term unless one is given', () => {
    const supplier = create({ name: '  Distribuidora Andina ', fiscalId: ' J-12345678-9 ', email: '', phone: null });

    expect(supplier.toPrimitives()).toMatchObject({
      code: 'PRV000001',
      name: 'Distribuidora Andina',
      fiscalId: 'J-12345678-9',
      email: null,
      phone: null,
      paymentTermDays: 0,
      isActive: true,
    });
  });

  it('needs a name that fits its column', () => {
    expect(() => create({ name: '   ' })).toThrow(EmptyPurchasingTextError);
    expect(() => create({ name: 'x'.repeat(151) })).toThrow(PurchasingTextTooLongError);
  });

  it('keeps the fiscal identification as free text, up to thirty characters', () => {
    expect(create({ fiscalId: 'RIF J-00000000-0 sucursal' }).toPrimitives().fiscalId).toBe('RIF J-00000000-0 sucursal');
    expect(() => create({ fiscalId: 'x'.repeat(31) })).toThrow(PurchasingTextTooLongError);
  });

  it('rejects an email that is not one', () => {
    expect(() => create({ email: 'compras-at-andina' })).toThrow(InvalidSupplierEmailError);
    expect(create({ email: 'compras@andina.com' }).toPrimitives().email).toBe('compras@andina.com');
  });

  it.each([-1, 366, 1.5])('rejects a payment term of %s days', (days) => {
    expect(() => create({ paymentTermDays: days })).toThrow(InvalidPaymentTermError);
  });

  it('is deactivated and reactivated, never deleted', () => {
    const supplier = create();
    const later = new Date('2026-02-01T00:00:00.000Z');

    supplier.deactivate(later);
    expect(supplier.isActive()).toBe(false);

    supplier.activate(later);
    expect(supplier.toPrimitives()).toMatchObject({ isActive: true, updatedAt: later });
  });

  it('replaces its contact data on update and survives a round trip', () => {
    const supplier = create({ email: 'a@b.co', paymentTermDays: 30 });

    supplier.update({ name: 'Andina', paymentTermDays: 15 }, NOW);

    const copy = Supplier.fromPrimitives(supplier.toPrimitives());
    expect(copy.toPrimitives()).toEqual(supplier.toPrimitives());
    expect(copy.toPrimitives()).toMatchObject({ name: 'Andina', email: null, paymentTermDays: 15 });
  });
});
