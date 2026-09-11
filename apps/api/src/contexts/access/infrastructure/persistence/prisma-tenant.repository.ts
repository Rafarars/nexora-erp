import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { TenantSlug } from '../../domain/tenant/tenant-slug.vo.js';
import { Tenant } from '../../domain/tenant/tenant.entity.js';
import { TenantRepository } from '../../domain/tenant/tenant.repository.js';

@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenant: Tenant): Promise<void> {
    const { id, name, slug, isActive } = tenant.toPrimitives();

    // El puerto expone save(), no create() ni update(): quien llama no decide si la
    // fila existe. Eso lo resuelve el adaptador.
    await this.prisma.tenant.upsert({
      where: { id },
      create: { id, name, slug, isActive },
      update: { name, slug, isActive },
    });
  }

  async find(id: TenantId): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { id: id.value } });

    return row ? Tenant.fromPrimitives(row) : null;
  }

  async findBySlug(slug: TenantSlug): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { slug: slug.value } });

    return row ? Tenant.fromPrimitives(row) : null;
  }

  async searchAll(): Promise<Tenant[]> {
    const rows = await this.prisma.tenant.findMany({ orderBy: { slug: 'asc' } });

    return rows.map((row) => Tenant.fromPrimitives(row));
  }
}
