import { AccountCode } from '../../domain/account/account-code.vo.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { AccountRepository, AccountSearchFilter } from '../../domain/account/account.repository.js';
import { Account, AccountPrimitives } from '../../domain/account/account.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly items = new Map<string, AccountPrimitives>();

  async save(account: Account): Promise<void> {
    const primitives = account.toPrimitives();
    const key = `${primitives.tenantId}:${primitives.id}`;
    this.items.set(key, { ...primitives });
  }

  async findById(tenantId: TenantId, id: AccountId): Promise<Account | null> {
    const key = `${tenantId.value}:${id.value}`;
    const found = this.items.get(key);
    return found ? Account.rehydrate(found) : null;
  }

  async findByCode(tenantId: TenantId, code: AccountCode): Promise<Account | null> {
    for (const item of this.items.values()) {
      if (item.tenantId === tenantId.value && item.code === code.raw) {
        return Account.rehydrate(item);
      }
    }
    return null;
  }

  async search(tenantId: TenantId, filter?: AccountSearchFilter): Promise<Account[]> {
    const result: Account[] = [];
    for (const item of this.items.values()) {
      if (item.tenantId !== tenantId.value) continue;
      if (filter?.isActive !== undefined && item.isActive !== filter.isActive) continue;
      if (filter?.type !== undefined && item.type !== filter.type) continue;
      if (filter?.parentId !== undefined) {
        const expectedParent = filter.parentId ? filter.parentId.value : null;
        if (item.parentId !== expectedParent) continue;
      }
      result.push(Account.rehydrate(item));
    }
    return result.sort((a, b) => a.code().raw.localeCompare(b.code().raw));
  }

  async hasChildren(tenantId: TenantId, id: AccountId): Promise<boolean> {
    for (const item of this.items.values()) {
      if (item.tenantId === tenantId.value && item.parentId === id.value) {
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.items.clear();
  }
}
