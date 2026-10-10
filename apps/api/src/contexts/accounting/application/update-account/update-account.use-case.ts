import { AccountId } from '../../domain/account/account-id.vo.js';
import type { AccountRepository } from '../../domain/account/account.repository.js';
import { AccountHasChildrenError, AccountNotFoundError } from '../../domain/errors/accounting.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface UpdateAccountCommand {
  tenantId: string;
  id: string;
  name?: string;
  isActive?: boolean;
  acceptsEntries?: boolean;
}

export class UpdateAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<void> {
    const tenantId = TenantId.of(command.tenantId);
    const id = AccountId.of(command.id);

    const account = await this.accountRepository.findById(tenantId, id);
    if (!account) {
      throw new AccountNotFoundError(command.id);
    }

    if (command.acceptsEntries === true) {
      const hasChildren = await this.accountRepository.hasChildren(tenantId, id);
      if (hasChildren) {
        throw new AccountHasChildrenError(account.code().raw);
      }
    }

    account.update({
      name: command.name,
      isActive: command.isActive,
      acceptsEntries: command.acceptsEntries,
    });

    await this.accountRepository.save(account);
  }
}
