import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { Membership } from '../../domain/membership/membership.entity.js';
import { Role } from '../../domain/role/role.entity.js';
import { Tenant } from '../../domain/tenant/tenant.entity.js';
import { User } from '../../domain/user/user.entity.js';
import { NOW } from '../../domain/testing/access.mother.js';
import { FakePasswordHasher } from '../../infrastructure/testing/fake-password-hasher.js';
import { FixedClock } from '../../infrastructure/testing/fixed-clock.js';
import { InMemoryMembershipRepository } from '../../infrastructure/testing/in-memory-membership.repository.js';
import { InMemoryRoleRepository } from '../../infrastructure/testing/in-memory-role.repository.js';
import { InMemoryTenantRepository } from '../../infrastructure/testing/in-memory-tenant.repository.js';
import { InMemoryUserRepository } from '../../infrastructure/testing/in-memory-user.repository.js';
import { SequentialIdGenerator } from '../../infrastructure/testing/sequential-id-generator.js';
import { MemberEnroller } from '../../domain/membership/enroll/member-enroller.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { TenantFinder } from '../../domain/tenant/find/tenant-finder.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { UserRegistrar } from '../../domain/user/register/user-registrar.js';
import { CatalogPermissions } from '../../domain/role/catalog-permissions.js';
import { AccessSessionBuilder } from '../session/access-session-builder.js';

export interface AccessScenario {
  users: InMemoryUserRepository;
  tenants: InMemoryTenantRepository;
  memberships: InMemoryMembershipRepository;
  roles: InMemoryRoleRepository;
  hasher: FakePasswordHasher;
  ids: IdGenerator;
  clock: Clock;
  session: AccessSessionBuilder;
  // Los servicios de dominio se arman aqui una vez: cada prueba pide el que necesita
  // sin volver a cablear sus dependencias.
  tenantFinder: TenantFinder;
  userFinder: UserFinder;
  membershipFinder: MembershipFinder;
  roleFinder: RoleFinder;
  registrar: UserRegistrar;
  enroller: MemberEnroller;
  catalog: CatalogPermissions;
}

// Monta el mundo de una prueba de aplicacion en una linea. Sin base de datos, sin
// Docker y sin NestJS: si algun dia hiciera falta alguno, la hexagonal se rompio.
export function anAccessScenario(
  seed: {
    users?: User[];
    tenants?: Tenant[];
    memberships?: Membership[];
    roles?: Role[];
  } = {},
): AccessScenario {
  const users = new InMemoryUserRepository(seed.users ?? []);
  const tenants = new InMemoryTenantRepository(seed.tenants ?? []);
  const memberships = new InMemoryMembershipRepository(seed.memberships ?? []);
  const roles = new InMemoryRoleRepository(seed.roles ?? []);
  const hasher = new FakePasswordHasher();
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(NOW);

  return {
    users,
    tenants,
    memberships,
    roles,
    hasher,
    ids,
    clock,
    session: new AccessSessionBuilder(tenants, memberships, roles),
    tenantFinder: new TenantFinder(tenants),
    userFinder: new UserFinder(users),
    membershipFinder: new MembershipFinder(memberships),
    roleFinder: new RoleFinder(roles),
    registrar: new UserRegistrar(users, hasher, ids, clock),
    enroller: new MemberEnroller(memberships, ids, clock),
    catalog: new CatalogPermissions(),
  };
}
