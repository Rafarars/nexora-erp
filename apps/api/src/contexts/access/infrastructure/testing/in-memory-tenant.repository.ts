import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { TenantSlug } from '../../domain/tenant/tenant-slug.vo.js';
import { Tenant } from '../../domain/tenant/tenant.entity.js';
import { TenantRepository } from '../../domain/tenant/tenant.repository.js';

// Guarda primitivas y no entidades: asi el doble se comporta como una base de verdad
// y una prueba no puede pasar por compartir la misma instancia en memoria.
export class InMemoryTenantRepository implements TenantRepository {
  private readonly rows = new Map<string, ReturnType<Tenant['toPrimitives']>>();

  constructor(seed: Tenant[] = []) {
    seed.forEach((tenant) => this.rows.set(tenant.id.value, tenant.toPrimitives()));
  }

  async save(tenant: Tenant): Promise<void> {
    this.rows.set(tenant.id.value, tenant.toPrimitives());
  }

  async find(id: TenantId): Promise<Tenant | null> {
    const row = this.rows.get(id.value);

    return row ? Tenant.fromPrimitives(row) : null;
  }

  async findBySlug(slug: TenantSlug): Promise<Tenant | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.slug === slug.value);

    return row ? Tenant.fromPrimitives(row) : null;
  }

  async searchAll(): Promise<Tenant[]> {
    return [...this.rows.values()].map((row) => Tenant.fromPrimitives(row));
  }
}
