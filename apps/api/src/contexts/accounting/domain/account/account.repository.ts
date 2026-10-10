import { TenantId } from '../shared/tenant-id.vo.js';
import { AccountCode } from './account-code.vo.js';
import { AccountId } from './account-id.vo.js';
import { AccountType } from './account-type.vo.js';
import { Account } from './account.entity.js';

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');

export interface AccountSearchFilter {
  isActive?: boolean;
  type?: AccountType;
  parentId?: AccountId | null;
}

export interface AccountRepository {
  save(account: Account): Promise<void>;
  findById(tenantId: TenantId, id: AccountId): Promise<Account | null>;
  findByCode(tenantId: TenantId, code: AccountCode): Promise<Account | null>;
  search(tenantId: TenantId, filter?: AccountSearchFilter): Promise<Account[]>;
  hasChildren(tenantId: TenantId, id: AccountId): Promise<boolean>;
}
