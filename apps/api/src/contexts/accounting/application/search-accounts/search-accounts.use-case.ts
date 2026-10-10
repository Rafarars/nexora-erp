import type { AccountRepository } from '../../domain/account/account.repository.js';
import { AccountType } from '../../domain/account/account-type.vo.js';
import { AccountPrimitives } from '../../domain/account/account.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SearchAccountsQuery {
  tenantId: string;
  isActive?: boolean;
  type?: AccountType;
}

export interface AccountTreeNode extends AccountPrimitives {
  children?: AccountTreeNode[];
}

export class SearchAccountsUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(query: SearchAccountsQuery): Promise<AccountPrimitives[]> {
    const tenantId = TenantId.of(query.tenantId);
    const accounts = await this.accountRepository.search(tenantId, {
      isActive: query.isActive,
      type: query.type,
    });

    return accounts.map((a) => a.toPrimitives());
  }

  async getTree(tenantIdStr: string): Promise<AccountTreeNode[]> {
    const tenantId = TenantId.of(tenantIdStr);
    const accounts = await this.accountRepository.search(tenantId);
    const primitives = accounts.map((a) => a.toPrimitives());

    const map = new Map<string, AccountTreeNode>();
    for (const p of primitives) {
      map.set(p.id, { ...p, children: [] });
    }

    const roots: AccountTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
