import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';
import { DuplicateCustomerNameError } from '../../domain/errors/sales.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Customer, CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(customer: Customer): Promise<void> {
    const { id, tenantId, ...row } = customer.toPrimitives();

    try {
      await this.prisma.customer.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: { id, tenantId, ...row },
        update: { ...row, code: undefined, createdAt: undefined },
      });
    } catch (error) {
      // Dos altas simultaneas con el mismo nombre pasan las dos la comprobacion previa.
      if (violates(error, 'name')) throw new DuplicateCustomerNameError(row.name, tenantId);

      throw error;
    }
  }

  async find(tenantId: TenantId, id: CustomerId): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({ where: { tenantId: tenantId.value, id: id.value } });

    return row ? Customer.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({ where: { tenantId: tenantId.value, name } });

    return row ? Customer.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Customer[]> {
    const rows = await this.prisma.customer.findMany({ where: { tenantId: tenantId.value }, orderBy: { name: 'asc' } });

    return rows.map((row) => Customer.fromPrimitives(row));
  }
}
