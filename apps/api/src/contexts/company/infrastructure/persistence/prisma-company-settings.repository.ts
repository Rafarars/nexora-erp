import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CompanySettings } from '../../domain/settings/company-settings.entity.js';
import { CompanySettingsRepository } from '../../domain/settings/company-settings.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaCompanySettingsRepository implements CompanySettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: TenantId): Promise<CompanySettings | null> {
    const row = await this.prisma.companySettings.findUnique({ where: { tenantId: tenantId.value } });

    return row ? CompanySettings.fromPrimitives(row) : null;
  }

  async save(settings: CompanySettings): Promise<void> {
    const { tenantId, updatedAt, ...values } = settings.toPrimitives();
    // El tipo de tasa sale del objeto de valor: la base lo guarda como enum.
    const data = { ...values, rateType: settings.rateType().value, updatedAt: updatedAt ?? new Date() };

    await this.prisma.companySettings.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }
}
