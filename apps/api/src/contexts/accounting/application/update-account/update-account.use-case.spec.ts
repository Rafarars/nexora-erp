import { describe, expect, it } from 'vitest';
import { UpdateAccountUseCase } from './update-account.use-case.js';
import { InMemoryAccountRepository } from '../../infrastructure/testing/in-memory-account.repository.js';
import { Account } from '../../domain/account/account.entity.js';
import { AccountCode } from '../../domain/account/account-code.vo.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { AccountHasChildrenError, AccountNotFoundError } from '../../domain/errors/accounting.errors.js';

describe('UpdateAccountUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const parentId = '22222222-2222-4222-8222-222222222222';
  const childId = '33333333-3333-4333-8333-333333333333';

  it('updates account name and active status', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new UpdateAccountUseCase(repository);

    await repository.save(
      Account.create(AccountId.of(parentId), TenantId.of(tenantId), {
        code: AccountCode.of('1'),
        name: 'Activo',
        type: 'asset',
        acceptsEntries: false,
      }),
    );

    await useCase.execute({
      tenantId,
      id: parentId,
      name: 'Activos Totales',
      isActive: false,
    });

    const updated = await repository.findById(TenantId.of(tenantId), AccountId.of(parentId));
    expect(updated!.name()).toBe('Activos Totales');
    expect(updated!.isActive()).toBe(false);
  });

  it('rejects update if account does not exist', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new UpdateAccountUseCase(repository);

    await expect(
      useCase.execute({
        tenantId,
        id: '99999999-9999-4999-8999-999999999999',
        name: 'No existe',
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('rejects making account accept entries if it has child accounts', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new UpdateAccountUseCase(repository);

    await repository.save(
      Account.create(AccountId.of(parentId), TenantId.of(tenantId), {
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
        parentId: AccountId.of(parentId),
      }),
    );

    await expect(
      useCase.execute({
        tenantId,
        id: parentId,
        acceptsEntries: true,
      }),
    ).rejects.toThrow(AccountHasChildrenError);
  });
});
