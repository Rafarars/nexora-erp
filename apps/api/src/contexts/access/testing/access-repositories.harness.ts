import { MembershipRepository } from '../domain/membership/membership.repository.js';
import { RoleRepository } from '../domain/role/role.repository.js';
import { TenantRepository } from '../domain/tenant/tenant.repository.js';
import { UserRepository } from '../domain/user/user.repository.js';

export interface AccessRepositories {
  tenants: TenantRepository;
  users: UserRepository;
  memberships: MembershipRepository;
  roles: RoleRepository;
}

// Lo unico que cada implementacion tiene que saber hacer distinto: entregar los cuatro
// repositorios y dejar el mundo vacio. El contrato no sabe si detras hay un Map o
// PostgreSQL, y ese es justo el punto.
export interface AccessRepositoriesHarness {
  repositories(): AccessRepositories;
  reset(): Promise<void>;
  close(): Promise<void>;
}
