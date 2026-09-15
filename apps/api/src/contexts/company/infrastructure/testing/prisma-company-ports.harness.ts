import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TENANT_A, TENANT_B } from '../../domain/testing/company.mother.js';
import { CompanyPorts, CompanyPortsHarness } from '../../testing/company-ports.harness.js';
import { PrismaCompanyActivity } from '../persistence/prisma-company-activity.js';
import { PrismaCompanyProfileRepository } from '../persistence/prisma-company-profile.repository.js';
import { PrismaCompanySettingsRepository } from '../persistence/prisma-company-settings.repository.js';
import { PrismaCurrencyCatalog } from '../persistence/prisma-currency-catalog.js';
import { PrismaTenantNames } from '../persistence/prisma-tenant-names.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

export class PrismaCompanyPortsHarness implements CompanyPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private sequence = 0;

  ports(): CompanyPorts {
    return {
      settings: new PrismaCompanySettingsRepository(this.prisma),
      profiles: new PrismaCompanyProfileRepository(this.prisma),
      currencies: new PrismaCurrencyCatalog(this.prisma),
      names: new PrismaTenantNames(this.prisma),
      activity: new PrismaCompanyActivity(this.prisma),
    };
  }

  // Un ajuste es el documento mas simple: solo pide una bodega detras.
  async document(tenantId: string, status: 'draft' | 'confirmed'): Promise<void> {
    const number = ++this.sequence;
    const warehouseId = randomUUID();

    await this.prisma.warehouse.create({ data: { id: warehouseId, tenantId, code: `BOD${900000 + number}`, name: `Contrato ${number}` } });
    await this.prisma.adjustment.create({
      data: { id: randomUUID(), tenantId, code: `AJU${900000 + number}`, warehouseId, adjustmentDate: new Date('2026-01-15'), status },
    });
  }

  // Solo toca a las dos empresas de prueba.
  async reset(): Promise<void> {
    const tenants = [TENANT_A, TENANT_B];

    await this.prisma.adjustment.deleteMany({ where: { tenantId: { in: tenants } } });
    await this.prisma.warehouse.deleteMany({ where: { tenantId: { in: tenants }, code: { startsWith: 'BOD9' } } });
    await this.prisma.companySettings.deleteMany({ where: { tenantId: { in: tenants } } });
    await this.prisma.companyProfile.deleteMany({ where: { tenantId: { in: tenants } } });

    for (const [id, name, slug] of [
      [TENANT_A, 'Contrato A', 'contract-company-a'],
      [TENANT_B, 'Contrato B', 'contract-company-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name, slug }, update: { name } });
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
