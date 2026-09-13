import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';
import { DuplicateSupplierNameError } from '../../domain/errors/purchasing.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(supplier: Supplier): Promise<void> {
    const { id, tenantId, ...row } = supplier.toPrimitives();

    try {
      await this.prisma.supplier.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: { id, tenantId, ...row },
        update: { ...row, code: undefined, createdAt: undefined },
      });
    } catch (error) {
      // Dos altas simultaneas con el mismo nombre pasan las dos la comprobacion previa.
      if (violates(error, 'name')) throw new DuplicateSupplierNameError(row.name, tenantId);

      throw error;
    }
  }

  async find(tenantId: TenantId, id: SupplierId): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findFirst({ where: { tenantId: tenantId.value, id: id.value } });

    return row ? Supplier.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findFirst({ where: { tenantId: tenantId.value, name } });

    return row ? Supplier.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Supplier[]> {
    const rows = await this.prisma.supplier.findMany({ where: { tenantId: tenantId.value }, orderBy: { name: 'asc' } });

    return rows.map((row) => Supplier.fromPrimitives(row));
  }
}
