import { TenantId } from '../tenant/tenant-id.vo.js';
import { RoleId } from './role-id.vo.js';
import { RoleName } from './role-name.vo.js';
import { Role } from './role.entity.js';

export const ROLE_REPOSITORY = Symbol('RoleRepository');

export interface RoleRepository {
  save(role: Role): Promise<void>;
  find(tenantId: TenantId, id: RoleId): Promise<Role | null>;
  findByName(tenantId: TenantId, name: RoleName): Promise<Role | null>;
  searchByIds(tenantId: TenantId, ids: RoleId[]): Promise<Role[]>;
  searchByTenant(tenantId: TenantId): Promise<Role[]>;
}
