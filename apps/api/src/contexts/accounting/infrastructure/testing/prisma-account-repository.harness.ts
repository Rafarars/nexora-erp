import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AccountRepositoryHarness } from '../../testing/account-repository.contract.js';
import { PrismaAccountRepository } from '../persistence/prisma-account.repository.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');
  }
  return url;
}

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

export class PrismaAccountRepositoryHarness implements AccountRepositoryHarness {
  readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  readonly repository = new PrismaAccountRepository(this.prisma);

  async reset(): Promise<void> {
    for (const [id, slug, name] of [
      [TENANT_A, 'tenant-acc-a', 'Empresa Contabilidad A'],
      [TENANT_B, 'tenant-acc-b', 'Empresa Contabilidad B'],
    ]) {
      await this.prisma.tenant.upsert({
        where: { id },
        create: { id, slug, name },
        update: {},
      });
    }

    await this.prisma.journalEntryLine.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await this.prisma.journalEntry.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await this.prisma.account.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
