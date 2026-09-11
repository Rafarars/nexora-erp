import { RoleNotFoundError } from '../../errors/role-not-found.error.js';
import { TenantId } from '../../tenant/tenant-id.vo.js';
import { RoleId } from '../role-id.vo.js';
import { Role } from '../role.entity.js';
import { RoleRepository } from '../role.repository.js';

export class RoleFinder {
  constructor(private readonly roles: RoleRepository) {}

  async find(tenantId: TenantId, id: RoleId): Promise<Role> {
    const role = await this.roles.find(tenantId, id);

    if (!role) {
      throw new RoleNotFoundError(id.value);
    }

    return role;
  }

  // Un rol de otra empresa llega como inexistente porque el repositorio filtra por
  // empresa: el aislamiento no depende de que alguien se acuerde de comprobarlo.
  async findAll(tenantId: TenantId, ids: RoleId[]): Promise<Role[]> {
    const found = await this.roles.searchByIds(tenantId, ids);

    for (const id of ids) {
      if (!found.some((role) => role.id.equals(id))) {
        throw new RoleNotFoundError(id.value);
      }
    }

    return found;
  }
}
