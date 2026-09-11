import { RoleId } from '../../domain/role/role-id.vo.js';
import { RoleName } from '../../domain/role/role-name.vo.js';
import { Role } from '../../domain/role/role.entity.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';

export class InMemoryRoleRepository implements RoleRepository {
  private readonly rows = new Map<string, ReturnType<Role['toPrimitives']>>();

  constructor(seed: Role[] = []) {
    seed.forEach((role) => this.rows.set(role.id.value, role.toPrimitives()));
  }

  async save(role: Role): Promise<void> {
    this.rows.set(role.id.value, role.toPrimitives());
  }

  async find(tenantId: TenantId, id: RoleId): Promise<Role | null> {
    const row = this.rows.get(id.value);

    if (!row || row.tenantId !== tenantId.value) {
      return null;
    }

    return Role.fromPrimitives(row);
  }

  async findByName(tenantId: TenantId, name: RoleName): Promise<Role | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.tenantId === tenantId.value && candidate.name === name.value,
    );

    return row ? Role.fromPrimitives(row) : null;
  }

  async searchByIds(tenantId: TenantId, ids: RoleId[]): Promise<Role[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value && wanted.has(row.id))
      .map((row) => Role.fromPrimitives(row));
  }

  async searchByTenant(tenantId: TenantId): Promise<Role[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .map((row) => Role.fromPrimitives(row));
  }
}
