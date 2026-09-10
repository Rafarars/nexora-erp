import { TenantId } from './tenant-id.vo.js';
import { TenantSlug } from './tenant-slug.vo.js';
import { Tenant } from './tenant.entity.js';

export const TENANT_REPOSITORY = Symbol('TenantRepository');

// La empresa es la raiz del aislamiento, asi que aqui el TenantId ES la identidad:
// no hay un filtro adicional que olvidar.
export interface TenantRepository {
  save(tenant: Tenant): Promise<void>;
  find(id: TenantId): Promise<Tenant | null>;
  findBySlug(slug: TenantSlug): Promise<Tenant | null>;
  searchAll(): Promise<Tenant[]>;
}
