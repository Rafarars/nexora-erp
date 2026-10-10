import { beforeEach, describe, expect, it } from 'vitest';
import { AccountCode } from '../domain/account/account-code.vo.js';
import { AccountId } from '../domain/account/account-id.vo.js';
import { AccountRepository } from '../domain/account/account.repository.js';
import { Account } from '../domain/account/account.entity.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';

export interface AccountRepositoryHarness {
  repository: AccountRepository;
  reset(): Promise<void>;
}

export function describeAccountRepositoryContract(
  name: string,
  createHarness: () => Promise<AccountRepositoryHarness>,
): void {
  describe(`AccountRepository contract: ${name}`, () => {
    let harness: AccountRepositoryHarness;
    const tenantA = TenantId.of('11111111-1111-4111-8111-111111111111');
    const tenantB = TenantId.of('22222222-2222-4222-8222-222222222222');

    beforeEach(async () => {
      harness = await createHarness();
      await harness.reset();
    });

    it('saves and finds an account by id and by code', async () => {
      const id = AccountId.of('33333333-3333-4333-8333-333333333333');
      const account = Account.create(id, tenantA, {
        code: AccountCode.of('1.1'),
        name: 'Activo corriente',
        type: 'asset',
        acceptsEntries: false,
      });

      await harness.repository.save(account);

      const foundById = await harness.repository.findById(tenantA, id);
      expect(foundById).not.toBeNull();
      expect(foundById!.toPrimitives()).toEqual(account.toPrimitives());

      const foundByCode = await harness.repository.findByCode(tenantA, AccountCode.of('1.1'));
      expect(foundByCode).not.toBeNull();
      expect(foundByCode!.id().value).toBe(id.value);
    });

    it('isolates accounts between tenants', async () => {
      const idA = AccountId.of('44444444-4444-4444-8444-444444444444');
      const accountA = Account.create(idA, tenantA, {
        code: AccountCode.of('1.1'),
        name: 'Activo corriente A',
        type: 'asset',
        acceptsEntries: false,
      });

      await harness.repository.save(accountA);

      expect(await harness.repository.findById(tenantB, idA)).toBeNull();
      expect(await harness.repository.findByCode(tenantB, AccountCode.of('1.1'))).toBeNull();
    });

    it('updates an existing account on save', async () => {
      const id = AccountId.of('55555555-5555-4555-8555-555555555555');
      const account = Account.create(id, tenantA, {
        code: AccountCode.of('1.1.01'),
        name: 'Caja',
        type: 'asset',
        acceptsEntries: true,
      });

      await harness.repository.save(account);

      account.update({ name: 'Caja y bancos', isActive: false });
      await harness.repository.save(account);

      const updated = await harness.repository.findById(tenantA, id);
      expect(updated!.name()).toBe('Caja y bancos');
      expect(updated!.isActive()).toBe(false);
    });

    it('determines if an account has children', async () => {
      const parentId = AccountId.of('66666666-6666-4666-8666-666666666666');
      const childId = AccountId.of('77777777-7777-4777-8777-777777777777');

      const parent = Account.create(parentId, tenantA, {
        code: AccountCode.of('1'),
        name: 'Activo',
        type: 'asset',
        acceptsEntries: false,
      });

      const child = Account.create(childId, tenantA, {
        code: AccountCode.of('1.1'),
        name: 'Activo corriente',
        type: 'asset',
        acceptsEntries: false,
        parentId,
      });

      await harness.repository.save(parent);
      expect(await harness.repository.hasChildren(tenantA, parentId)).toBe(false);

      await harness.repository.save(child);
      expect(await harness.repository.hasChildren(tenantA, parentId)).toBe(true);
      expect(await harness.repository.hasChildren(tenantA, childId)).toBe(false);
    });

    it('filters accounts by type and active status', async () => {
      const a1 = Account.create(AccountId.of('88888888-8888-4888-8888-888888888881'), tenantA, {
        code: AccountCode.of('1'),
        name: 'Activo',
        type: 'asset',
        acceptsEntries: false,
      });
      const a2 = Account.create(AccountId.of('88888888-8888-4888-8888-888888888882'), tenantA, {
        code: AccountCode.of('2'),
        name: 'Pasivo',
        type: 'liability',
        acceptsEntries: false,
      });
      a2.update({ isActive: false });

      await harness.repository.save(a1);
      await harness.repository.save(a2);

      const assets = await harness.repository.search(tenantA, { type: 'asset' });
      expect(assets).toHaveLength(1);
      expect(assets[0].code().raw).toBe('1');

      const activeOnly = await harness.repository.search(tenantA, { isActive: true });
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0].code().raw).toBe('1');

      const all = await harness.repository.search(tenantA);
      expect(all).toHaveLength(2);
    });
  });
}
