import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violatedUniqueFields, violates } from '../../../../shared/prisma/unique-violation.js';
import { ConcurrentDefaultPriceListError, DuplicatePriceListNameError } from '../../domain/errors/price-list.errors.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { PriceListName } from '../../domain/price-list/price-list-name.vo.js';
import { PriceList } from '../../domain/price-list/price-list.entity.js';
import { PriceListRepository } from '../../domain/price-list/price-list.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

const ONE_DEFAULT_PER_TENANT = 'price_lists_one_default_per_tenant';

@Injectable()
export class PrismaPriceListRepository implements PriceListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(priceList: PriceList): Promise<void> {
    await this.saveAll([priceList]);
  }

  async saveAll(priceLists: PriceList[]): Promise<void> {
    // Primero las que pierden la marca: asi en ningun instante de la transaccion hay dos por
    // defecto.
    const ordered = [...priceLists].sort((left, right) => Number(left.isDefault()) - Number(right.isDefault()));

    try {
      await this.prisma.$transaction(
        ordered.map((priceList) => {
          const { id, tenantId, code, name, description, currency, isDefault, isActive, createdAt, updatedAt } =
            priceList.toPrimitives();

          return this.prisma.priceList.upsert({
            where: { tenantId_id: { tenantId, id } },
            create: { id, tenantId, code, name, description, currency, isDefault, isActive, createdAt, updatedAt },
            update: { name, description, isDefault, isActive, updatedAt },
          });
        }),
      );
    } catch (error) {
      if (violatedUniqueFields(error)?.includes(ONE_DEFAULT_PER_TENANT)) {
        throw new ConcurrentDefaultPriceListError(priceLists[0].tenantId.value);
      }

      if (violates(error, 'name')) {
        const clashing = priceLists[0].toPrimitives();

        throw new DuplicatePriceListNameError(clashing.name, clashing.tenantId);
      }

      throw error;
    }
  }

  async find(tenantId: TenantId, id: PriceListId): Promise<PriceList | null> {
    const row = await this.prisma.priceList.findFirst({ where: { id: id.value, tenantId: tenantId.value } });

    return row ? PriceList.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: PriceListName): Promise<PriceList | null> {
    const row = await this.prisma.priceList.findFirst({ where: { tenantId: tenantId.value, name: name.value } });

    return row ? PriceList.fromPrimitives(row) : null;
  }

  async findDefault(tenantId: TenantId): Promise<PriceList | null> {
    const row = await this.prisma.priceList.findFirst({ where: { tenantId: tenantId.value, isDefault: true } });

    return row ? PriceList.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<PriceList[]> {
    const rows = await this.prisma.priceList.findMany({ where: { tenantId: tenantId.value }, orderBy: { name: 'asc' } });

    return rows.map((row) => PriceList.fromPrimitives(row));
  }
}
