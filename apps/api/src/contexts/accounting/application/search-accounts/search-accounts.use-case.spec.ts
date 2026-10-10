import { describe, expect, it } from 'vitest';
import { SearchAccountsUseCase } from './search-accounts.use-case.js';
import { InMemoryAccountRepository } from '../../infrastructure/testing/in-memory-account.repository.js';
import { Account } from '../../domain/account/account.entity.js';
import { AccountCode } from '../../domain/account/account-code.vo.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

describe('SearchAccountsUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const rootId = '22222222-2222-4222-8222-222222222222';
  const childId = '33333333-3333-4333-8333-333333333333';

  it('searches accounts and builds hierarchy tree', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new SearchAccountsUseCase(repository);

    await repository.save(
      Account.create(AccountId.of(rootId), TenantId.of(tenantId), {
        code: AccountCode.of('1'),
        name: 'Activo',
        type: 'asset',
        acceptsEntries: false,
      }),
    );

    await repository.save(
      Account.create(AccountId.of(childId), TenantId.of(tenantId), {
        code: AccountCode.of('1.1'),
        name: 'Activo corriente',
        type: 'asset',
        acceptsEntries: true,
        parentId: AccountId.of(rootId),
      }),
    );

    const list = await useCase.execute({ tenantId });
    expect(list).toHaveLength(2);

    const tree = await useCase.getTree(tenantId);
    expect(tree).toHaveLength(1);
    expect(tree[0].code).toBe('1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].code).toBe('1.1');
  });
});
