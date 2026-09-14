import { describe, expect, it } from 'vitest';
import {
  EmptySalesTextError,
  InvalidPaymentTermError,
  InvalidCustomerEmailError,
  SalesTextTooLongError,
} from '../errors/sales.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { NOW, CUSTOMER, TENANT_A } from '../testing/sales.mother.js';
import { Customer, CustomerDetails, CustomerId } from './customer.entity.js';

const create = (details: Partial<CustomerDetails> = {}) =>
  Customer.create(CustomerId.of(CUSTOMER), TenantId.of(TENANT_A), 'CLI000001', { name: 'Comercial Delta', ...details }, NOW);

describe('Customer', () => {
  it('is born active, trimmed and with no payment term unless one is given', () => {
    const customer = create({ name: '  Comercial Delta ', fiscalId: ' J-12345678-9 ', email: '', phone: null });

    expect(customer.toPrimitives()).toMatchObject({
      code: 'CLI000001',
      name: 'Comercial Delta',
      fiscalId: 'J-12345678-9',
      email: null,
      phone: null,
      paymentTermDays: 0,
      isActive: true,
    });
  });

  it('needs a name that fits its column', () => {
    expect(() => create({ name: '   ' })).toThrow(EmptySalesTextError);
    expect(() => create({ name: 'x'.repeat(151) })).toThrow(SalesTextTooLongError);
  });

  it('keeps the fiscal identification as free text, up to thirty characters', () => {
    expect(create({ fiscalId: 'RIF J-00000000-0 sucursal' }).toPrimitives().fiscalId).toBe('RIF J-00000000-0 sucursal');
    expect(() => create({ fiscalId: 'x'.repeat(31) })).toThrow(SalesTextTooLongError);
  });

  it('rejects an email that is not one', () => {
    expect(() => create({ email: 'ventas-at-andina' })).toThrow(InvalidCustomerEmailError);
    expect(create({ email: 'ventas@andina.com' }).toPrimitives().email).toBe('ventas@andina.com');
  });

  it.each([-1, 366, 1.5])('rejects a payment term of %s days', (days) => {
    expect(() => create({ paymentTermDays: days })).toThrow(InvalidPaymentTermError);
  });

  it('is deactivated and reactivated, never deleted', () => {
    const customer = create();
    const later = new Date('2026-02-01T00:00:00.000Z');

    customer.deactivate(later);
    expect(customer.isActive()).toBe(false);

    customer.activate(later);
    expect(customer.toPrimitives()).toMatchObject({ isActive: true, updatedAt: later });
  });

  it('replaces its contact data on update and survives a round trip', () => {
    const customer = create({ email: 'a@b.co', paymentTermDays: 30 });

    customer.update({ name: 'Andina', paymentTermDays: 15 }, NOW);

    const copy = Customer.fromPrimitives(customer.toPrimitives());
    expect(copy.toPrimitives()).toEqual(customer.toPrimitives());
    expect(copy.toPrimitives()).toMatchObject({ name: 'Andina', email: null, paymentTermDays: 15 });
  });
});
