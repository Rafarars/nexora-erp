import { AccountCode } from '../../domain/account/account-code.vo.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import type { AccountRepository } from '../../domain/account/account.repository.js';
import { AccountType } from '../../domain/account/account-type.vo.js';
import { Account } from '../../domain/account/account.entity.js';
import {
  AccountCodeAlreadyExistsError,
  AccountParentNotFoundError,
  AccountTypeMismatchError,
} from '../../domain/errors/accounting.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import type { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';

export interface CreateAccountCommand {
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  acceptsEntries: boolean;
  parentId?: string | null;
}

export class CreateAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(command: CreateAccountCommand): Promise<{ id: string }> {
    const tenantId = TenantId.of(command.tenantId);
    const code = AccountCode.of(command.code);

    const existing = await this.accountRepository.findByCode(tenantId, code);
    if (existing) {
      throw new AccountCodeAlreadyExistsError(command.code);
    }

    let parentId: AccountId | null = null;
    if (command.parentId) {
      parentId = AccountId.of(command.parentId);
      const parent = await this.accountRepository.findById(tenantId, parentId);
      if (!parent) {
        throw new AccountParentNotFoundError(command.parentId);
      }

      if (parent.type() !== command.type) {
        throw new AccountTypeMismatchError(command.type, parent.type());
      }

      // Si el padre aceptaba asientos, ahora es una cuenta de grupo y ya no debe aceptar asientos directos
      if (parent.acceptsEntries()) {
        parent.update({ acceptsEntries: false });
        await this.accountRepository.save(parent);
      }
    }

    const id = AccountId.of(this.idGenerator.next());
    const account = Account.create(id, tenantId, {
      code,
      name: command.name,
      type: command.type,
      acceptsEntries: command.acceptsEntries,
      parentId,
    });

    await this.accountRepository.save(account);

    return { id: id.value };
  }
}
