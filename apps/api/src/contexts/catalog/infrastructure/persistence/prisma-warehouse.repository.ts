import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DuplicateWarehouseNameError } from '../../domain/errors/duplicate.errors.js';
import { ConcurrentDefaultWarehouseError } from '../../domain/errors/warehouse.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { WarehouseName } from '../../domain/warehouse/warehouse-name.vo.js';
import { Warehouse } from '../../domain/warehouse/warehouse.entity.js';
import { WarehouseRepository } from '../../domain/warehouse/warehouse.repository.js';
import { violatedUniqueFields, violates } from './unique-violation.js';

const ONE_DEFAULT_PER_TENANT = 'warehouses_one_default_per_tenant';

@Injectable()
export class PrismaWarehouseRepository implements WarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(warehouse: Warehouse): Promise<void> {
    await this.saveAll([warehouse]);
  }

  async saveAll(warehouses: Warehouse[]): Promise<void> {
    // Primero las que pierden la marca: asi, en ningun instante de la transaccion hay
    // dos por defecto.
    const ordered = [...warehouses].sort((left, right) => Number(left.isDefault()) - Number(right.isDefault()));

    try {
      await this.prisma.$transaction(
        ordered.map((warehouse) => {
          const { id, tenantId, code, name, address, isDefault, isActive, createdAt, updatedAt } = warehouse.toPrimitives();

          return this.prisma.warehouse.upsert({
            where: { tenantId_id: { tenantId, id } },
            create: { id, tenantId, code, name, address, isDefault, isActive, createdAt, updatedAt },
            update: { name, address, isDefault, isActive, updatedAt },
          });
        }),
      );
    } catch (error) {
      if (violatedUniqueFields(error)?.includes(ONE_DEFAULT_PER_TENANT)) {
        throw new ConcurrentDefaultWarehouseError(warehouses[0].tenantId.value);
      }

      if (violates(error, 'name')) {
        const clashing = warehouses[0].toPrimitives();

        throw new DuplicateWarehouseNameError(clashing.name, clashing.tenantId);
      }

      throw error;
    }
  }

  async find(tenantId: TenantId, id: WarehouseId): Promise<Warehouse | null> {
    const row = await this.prisma.warehouse.findFirst({ where: { id: id.value, tenantId: tenantId.value } });

    return row ? Warehouse.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: WarehouseName): Promise<Warehouse | null> {
    const row = await this.prisma.warehouse.findFirst({ where: { tenantId: tenantId.value, name: name.value } });

    return row ? Warehouse.fromPrimitives(row) : null;
  }

  async findDefault(tenantId: TenantId): Promise<Warehouse | null> {
    const row = await this.prisma.warehouse.findFirst({ where: { tenantId: tenantId.value, isDefault: true } });

    return row ? Warehouse.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Warehouse[]> {
    const rows = await this.prisma.warehouse.findMany({ where: { tenantId: tenantId.value }, orderBy: { name: 'asc' } });

    return rows.map((row) => Warehouse.fromPrimitives(row));
  }
}
