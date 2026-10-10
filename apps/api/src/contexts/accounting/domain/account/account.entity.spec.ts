import { describe, expect, it } from 'vitest';
import { Account } from './account.entity.js';
import { AccountCode } from './account-code.vo.js';
import { AccountId } from './account-id.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

describe('Account entity', () => {
  const tenantId = TenantId.of('11111111-1111-4111-8111-111111111111');
  const accountId = AccountId.of('22222222-2222-4222-8222-222222222222');

  it('creates an account with valid attributes', () => {
    const account = Account.create(accountId, tenantId, {
      code: AccountCode.of('1.1.01.001'),
      name: 'Caja general',
      type: 'asset',
      acceptsEntries: true,
    });

    expect(account.id().value).toBe(accountId.value);
    expect(account.code().raw).toBe('1.1.01.001');
    expect(account.name()).toBe('Caja general');
    expect(account.type()).toBe('asset');
    expect(account.acceptsEntries()).toBe(true);
    expect(account.parentId()).toBeNull();
    expect(account.isActive()).toBe(true);
    expect(account.canAcceptEntries()).toBe(true);
  });

  it('rejects an empty or too long name', () => {
    expect(() =>
      Account.create(accountId, tenantId, {
        code: AccountCode.of('1.1'),
        name: '   ',
        type: 'asset',
        acceptsEntries: false,
      }),
    ).toThrow(InvalidArgumentError);

    expect(() =>
      Account.create(accountId, tenantId, {
        code: AccountCode.of('1.1'),
        name: 'a'.repeat(121),
        type: 'asset',
        acceptsEntries: false,
      }),
    ).toThrow(InvalidArgumentError);
  });

  it('updates account name and active status', () => {
    const account = Account.create(accountId, tenantId, {
      code: AccountCode.of('1.1.01.001'),
      name: 'Caja general',
      type: 'asset',
      acceptsEntries: true,
    });

    account.update({ name: 'Caja chica', isActive: false });
    expect(account.name()).toBe('Caja chica');
    expect(account.isActive()).toBe(false);
    expect(account.canAcceptEntries()).toBe(false);
  });

  it('serializes to and from primitives', () => {
    const account = Account.create(accountId, tenantId, {
      code: AccountCode.of('1.1.01.001'),
      name: 'Caja general',
      type: 'asset',
      acceptsEntries: true,
      parentId: AccountId.of('33333333-3333-4333-8333-333333333333'),
    });

    const primitives = account.toPrimitives();
    const rehydrated = Account.rehydrate(primitives);

    expect(rehydrated.toPrimitives()).toEqual(primitives);
  });
});
