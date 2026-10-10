import { describe, expect, it } from 'vitest';
import { CreateAccountUseCase } from '../../application/create-account/create-account.use-case.js';
import { SearchAccountsUseCase } from '../../application/search-accounts/search-accounts.use-case.js';
import { UpdateAccountUseCase } from '../../application/update-account/update-account.use-case.js';
import { InMemoryAccountRepository } from '../testing/in-memory-account.repository.js';
import { CreateAccountPostController } from './create-account-post.controller.js';
import { SearchAccountsGetController } from './search-accounts-get.controller.js';
import { UpdateAccountPutController } from './update-account-put.controller.js';
import { ChangeAccountStatusPutController } from './change-account-status-put.controller.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';

describe('Accounts HTTP Controllers', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const session: CurrentSession = {
    userId: 'u1111111-1111-4111-8111-111111111111',
    tenantId,
  };

  let nextId = 10;
  const mockIdGenerator = {
    next: () => `b0000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
  };

  it('creates, updates, changes status and searches accounts via controllers', async () => {
    const repository = new InMemoryAccountRepository();
    const createUseCase = new CreateAccountUseCase(repository, mockIdGenerator);
    const updateUseCase = new UpdateAccountUseCase(repository);
    const searchUseCase = new SearchAccountsUseCase(repository);

    const createController = new CreateAccountPostController(createUseCase);
    const updateController = new UpdateAccountPutController(updateUseCase);
    const statusController = new ChangeAccountStatusPutController(updateUseCase);
    const searchController = new SearchAccountsGetController(searchUseCase);

    // 1. Create account
    const { id } = await createController.run(session, {
      code: '1.1',
      name: 'Activo corriente',
      type: 'asset',
      acceptsEntries: false,
    });
    expect(id).toBeDefined();

    // 2. Search accounts
    const list = (await searchController.run(session, {})) as any[];
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe('1.1');

    // 3. Update account name
    await updateController.run(session, id, {
      name: 'Activo circulante',
    });

    // 4. Change status
    await statusController.run(session, id, {
      isActive: false,
    });

    const updatedList = (await searchController.run(session, {})) as any[];
    expect(updatedList[0].name).toBe('Activo circulante');
    expect(updatedList[0].isActive).toBe(false);
  });
});
