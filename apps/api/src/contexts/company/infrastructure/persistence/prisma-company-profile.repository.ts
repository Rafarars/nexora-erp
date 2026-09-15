import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CompanyProfile } from '../../domain/profile/company-profile.entity.js';
import { CompanyProfileRepository } from '../../domain/profile/company-profile.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaCompanyProfileRepository implements CompanyProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: TenantId): Promise<CompanyProfile | null> {
    const row = await this.prisma.companyProfile.findUnique({ where: { tenantId: tenantId.value } });

    return row ? CompanyProfile.fromPrimitives(row) : null;
  }

  async save(profile: CompanyProfile): Promise<void> {
    const { tenantId, updatedAt, ...values } = profile.toPrimitives();
    const data = { ...values, updatedAt: updatedAt ?? new Date() };

    await this.prisma.companyProfile.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }
}
