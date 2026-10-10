import { describe, expect, it } from 'vitest';
import { CreateAccountUseCase } from './create-account.use-case.js';
import { InMemoryAccountRepository } from '../../infrastructure/testing/in-memory-account.repository.js';
import {
  AccountCodeAlreadyExistsError,
  AccountParentNotFoundError,
  AccountTypeMismatchError,
} from '../../domain/errors/accounting.errors.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

describe('CreateAccountUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  let nextId = 100;
  const mockIdGenerator = {
    next: () => `a0000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
  };

  it('creates a root account successfully', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new CreateAccountUseCase(repository, mockIdGenerator);

    const { id } = await useCase.execute({
      tenantId,
      code: '1',
      name: 'Activo',
      type: 'asset',
      acceptsEntries: false,
    });

    const created = await repository.findById(TenantId.of(tenantId), AccountId.of(id));
    expect(created).not.toBeNull();
    expect(created!.code().raw).toBe('1');
    expect(created!.type()).toBe('asset');
    expect(created!.acceptsEntries()).toBe(false);
  });

  it('rejects duplicated codes in the same tenant', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new CreateAccountUseCase(repository, mockIdGenerator);

    await useCase.execute({
      tenantId,
      code: '1',
      name: 'Activo',
      type: 'asset',
      acceptsEntries: false,
    });

    await expect(
      useCase.execute({
        tenantId,
        code: '1',
        name: 'Otro Activo',
        type: 'asset',
        acceptsEntries: false,
      }),
    ).rejects.toThrow(AccountCodeAlreadyExistsError);
  });

  it('rejects creation when parent does not exist', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new CreateAccountUseCase(repository, mockIdGenerator);

    await expect(
      useCase.execute({
        tenantId,
        code: '1.1',
        name: 'Activo corriente',
        type: 'asset',
        acceptsEntries: false,
        parentId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toThrow(AccountParentNotFoundError);
  });

  it('rejects type mismatch between child and parent', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new CreateAccountUseCase(repository, mockIdGenerator);

    const { id: parentId } = await useCase.execute({
      tenantId,
      code: '1',
      name: 'Activo',
      type: 'asset',
      acceptsEntries: false,
    });

    await expect(
      useCase.execute({
        tenantId,
        code: '1.1',
        name: 'Pasivo falso',
        type: 'liability',
        acceptsEntries: false,
        parentId,
      }),
    ).rejects.toThrow(AccountTypeMismatchError);
  });

  it('turns parent acceptsEntries to false when a child is attached', async () => {
    const repository = new InMemoryAccountRepository();
    const useCase = new CreateAccountUseCase(repository, mockIdGenerator);

    const { id: parentId } = await useCase.execute({
      tenantId,
      code: '1.1',
      name: 'Activo corriente',
      type: 'asset',
      acceptsEntries: true,
    });

    await useCase.execute({
      tenantId,
      code: '1.1.01',
      name: 'Caja',
      type: 'asset',
      acceptsEntries: true,
      parentId,
    });

    const parent = await repository.findById(TenantId.of(tenantId), AccountId.of(parentId));
    expect(parent!.acceptsEntries()).toBe(false);
  });
});
