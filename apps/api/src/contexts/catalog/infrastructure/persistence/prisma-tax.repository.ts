import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DuplicateTaxNameError } from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TaxName } from '../../domain/tax/tax-name.vo.js';
import { Tax } from '../../domain/tax/tax.entity.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';
import { violates } from './unique-violation.js';

type TaxRow = Awaited<ReturnType<PrismaService['tax']['findFirstOrThrow']>>;

// La base guarda el porcentaje como decimal exacto; el dominio lo recibe como numero,
// que con cuatro decimales y hasta 100 no pierde precision.
function toDomain(row: TaxRow): Tax {
  return Tax.fromPrimitives({ ...row, rate: row.rate.toNumber() });
}

@Injectable()
export class PrismaTaxRepository implements TaxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(tax: Tax): Promise<void> {
    const { id, tenantId, code, name, rate, isActive, createdAt, updatedAt } = tax.toPrimitives();

    try {
      await this.prisma.tax.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: { id, tenantId, code, name, rate, isActive, createdAt, updatedAt },
        update: { name, rate, isActive, updatedAt },
      });
    } catch (error) {
      if (violates(error, 'name')) throw new DuplicateTaxNameError(name, tenantId);
      throw error;
    }
  }

  async find(tenantId: TenantId, id: TaxId): Promise<Tax | null> {
    const row = await this.prisma.tax.findFirst({ where: { id: id.value, tenantId: tenantId.value } });

    return row ? toDomain(row) : null;
  }

  async findByName(tenantId: TenantId, name: TaxName): Promise<Tax | null> {
    const row = await this.prisma.tax.findFirst({ where: { tenantId: tenantId.value, name: name.value } });

    return row ? toDomain(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Tax[]> {
    const rows = await this.prisma.tax.findMany({ where: { tenantId: tenantId.value }, orderBy: { name: 'asc' } });

    return rows.map(toDomain);
  }
}
