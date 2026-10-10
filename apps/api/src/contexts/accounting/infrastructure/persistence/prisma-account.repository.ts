import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';
import { AccountCode } from '../../domain/account/account-code.vo.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { AccountRepository, AccountSearchFilter } from '../../domain/account/account.repository.js';
import { Account } from '../../domain/account/account.entity.js';
import { AccountCodeAlreadyExistsError } from '../../domain/errors/accounting.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: Account): Promise<void> {
    const { id, tenantId, code, name, type, acceptsEntries, parentId, isActive } = account.toPrimitives();

    try {
      await this.prisma.account.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: {
          id,
          tenantId,
          code,
          name,
          type,
          acceptsEntries,
          parentId,
          isActive,
        },
        update: {
          code,
          name,
          acceptsEntries,
          parentId,
          isActive,
        },
      });
    } catch (error) {
      if (violates(error, 'code')) {
        throw new AccountCodeAlreadyExistsError(code);
      }
      throw error;
    }
  }

  async findById(tenantId: TenantId, id: AccountId): Promise<Account | null> {
    const row = await this.prisma.account.findFirst({
      where: {
        id: id.value,
        tenantId: tenantId.value,
      },
    });

    return row ? Account.rehydrate(row) : null;
  }

  async findByCode(tenantId: TenantId, code: AccountCode): Promise<Account | null> {
    const row = await this.prisma.account.findFirst({
      where: {
        code: code.raw,
        tenantId: tenantId.value,
      },
    });

    return row ? Account.rehydrate(row) : null;
  }

  async search(tenantId: TenantId, filter?: AccountSearchFilter): Promise<Account[]> {
    const where: any = { tenantId: tenantId.value };

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.type !== undefined) {
      where.type = filter.type;
    }

    if (filter?.parentId !== undefined) {
      where.parentId = filter.parentId ? filter.parentId.value : null;
    }

    const rows = await this.prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return rows.map((row) => Account.rehydrate(row));
  }

  async hasChildren(tenantId: TenantId, id: AccountId): Promise<boolean> {
    const count = await this.prisma.account.count({
      where: {
        tenantId: tenantId.value,
        parentId: id.value,
      },
    });

    return count > 0;
  }
}
