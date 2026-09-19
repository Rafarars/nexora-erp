import { TenantAdministration } from '../domain/membership/administration/tenant-administration.js';
import { MembershipRepository } from '../domain/membership/membership.repository.js';
import { RoleRepository } from '../domain/role/role.repository.js';
import { TenantRepository } from '../domain/tenant/tenant.repository.js';
import { UserRepository } from '../domain/user/user.repository.js';

export interface AccessRepositories {
  tenants: TenantRepository;
  users: UserRepository;
  memberships: MembershipRepository;
  roles: RoleRepository;
  // No es un repositorio: es la consulta que decide si alguien puede dejar de administrar.
  // Entra en el contrato porque contar mal aqui deja a una empresa sin gobierno.
  administration: TenantAdministration;
}

// Lo unico que cada implementacion tiene que saber hacer distinto: entregar las cinco
// piezas y dejar el mundo vacio. El contrato no sabe si detras hay un Map o
// PostgreSQL, y ese es justo el punto.
export interface AccessRepositoriesHarness {
  repositories(): AccessRepositories;
  reset(): Promise<void>;
  close(): Promise<void>;
}
