import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Clock, CLOCK } from '../../../shared/domain/ports/clock.js';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { UserAuthenticator } from '../application/authenticate-user/user-authenticator.js';
import { RoleAssigner } from '../application/assign-role/role-assigner.js';
import { UserCreator } from '../application/create-user/user-creator.js';
import { UserSearcher } from '../application/search-tenant-users/user-searcher.js';
import { AccessSessionBuilder } from '../application/session/access-session-builder.js';
import { TenantSwitcher } from '../application/switch-tenant/tenant-switcher.js';
import { MemberEnroller } from '../domain/membership/enroll/member-enroller.js';
import { MembershipFinder } from '../domain/membership/find/membership-finder.js';
import {
  MEMBERSHIP_REPOSITORY,
  MembershipRepository,
} from '../domain/membership/membership.repository.js';
import { RoleFinder } from '../domain/role/find/role-finder.js';
import { ROLE_REPOSITORY, RoleRepository } from '../domain/role/role.repository.js';
import { TenantFinder } from '../domain/tenant/find/tenant-finder.js';
import { TENANT_REPOSITORY, TenantRepository } from '../domain/tenant/tenant.repository.js';
import { UserFinder } from '../domain/user/find/user-finder.js';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/user/password-hasher.js';
import { UserRegistrar } from '../domain/user/register/user-registrar.js';
import { USER_REPOSITORY, UserRepository } from '../domain/user/user.repository.js';
import { MembershipStatusChanger } from '../application/change-membership-status/membership-status-changer.js';
import { PasswordChanger } from '../application/change-password/password-changer.js';
import { TenantUserUpdater } from '../application/update-tenant-user/tenant-user-updater.js';
import { ProfileUpdater } from '../application/update-profile/profile-updater.js';
import { SessionFinder } from '../application/find-session/session-finder.js';
import { RoleCreator } from '../application/create-role/role-creator.js';
import { RoleRevoker } from '../application/revoke-role/role-revoker.js';
import { RoleSearcher } from '../application/search-roles/role-searcher.js';
import { PermissionSearcher } from '../application/search-permissions/permission-searcher.js';
import { RoleUpdater } from '../application/update-role/role-updater.js';
import { CatalogPermissions } from '../domain/role/catalog-permissions.js';
import { AccessGuard } from './http/access.guard.js';
import { CreateRolePostController } from './http/create-role-post.controller.js';
import { RevokeRoleDeleteController } from './http/revoke-role-delete.controller.js';
import { SearchPermissionsGetController } from './http/search-permissions-get.controller.js';
import { SearchRolesGetController } from './http/search-roles-get.controller.js';
import { ChangeMembershipStatusPutController } from './http/change-membership-status-put.controller.js';
import { ChangePasswordPutController } from './http/change-password-put.controller.js';
import { UpdateTenantUserPutController } from './http/update-tenant-user-put.controller.js';
import { SessionGetController } from './http/session-get.controller.js';
import { UpdateProfilePutController } from './http/update-profile-put.controller.js';
import { UpdateRolePutController } from './http/update-role-put.controller.js';
import { AssignRolePostController } from './http/assign-role-post.controller.js';
import { CreateUserPostController } from './http/create-user-post.controller.js';
import { LoginPostController } from './http/login-post.controller.js';
import { SearchUsersGetController } from './http/search-users-get.controller.js';
import { SwitchTenantPostController } from './http/switch-tenant-post.controller.js';
import { PrismaMembershipRepository } from './persistence/prisma-membership.repository.js';
import { PrismaRoleRepository } from './persistence/prisma-role.repository.js';
import { PrismaTenantRepository } from './persistence/prisma-tenant.repository.js';
import { PrismaUserRepository } from './persistence/prisma-user.repository.js';
import { Argon2PasswordHasher } from './security/argon2-password-hasher.js';
import { InMemoryLoginAttempts } from './security/in-memory-login-attempts.js';
import { JoseTokenIssuer } from './security/jose-token-issuer.js';
import { LOGIN_ATTEMPTS } from '../domain/authenticate/login-attempts.js';
import type { LoginAttempts } from '../domain/authenticate/login-attempts.js';
import type { Env } from '../../../shared/config/env.schema.js';
import { TOKEN_ISSUER } from './security/token-issuer.js';

// El unico sitio del contexto donde se decide QUE implementacion resuelve cada puerto,
// y como se componen los casos de uso. Los tokens son Symbol porque las interfaces de
// TypeScript se borran al compilar.
//
// Los servicios de dominio y los casos de uso se construyen con `useFactory` a
// proposito: son clases sin decoradores, y asi el dominio no importa NestJS.
@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    LoginPostController,
    SwitchTenantPostController,
    CreateUserPostController,
    AssignRolePostController,
    SearchUsersGetController,
    SearchRolesGetController,
    SearchPermissionsGetController,
    CreateRolePostController,
    UpdateRolePutController,
    RevokeRoleDeleteController,
    SessionGetController,
    UpdateProfilePutController,
    ChangePasswordPutController,
    UpdateTenantUserPutController,
    ChangeMembershipStatusPutController,
  ],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: MEMBERSHIP_REPOSITORY, useClass: PrismaMembershipRepository },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JoseTokenIssuer },
    {
      provide: LOGIN_ATTEMPTS,
      useFactory: (config: ConfigService<Env, true>, clock: Clock) =>
        new InMemoryLoginAttempts(
          config.get('LOGIN_MAX_FAILED_ATTEMPTS', { infer: true }),
          config.get('LOGIN_LOCKOUT_SECONDS', { infer: true }),
          clock,
        ),
      inject: [ConfigService, CLOCK],
    },

    // Global: cubre TODA la aplicacion, tambien los endpoints de otros contextos que
    // se anadan despues. Un contexto nuevo nace protegido sin hacer nada.
    { provide: APP_GUARD, useClass: AccessGuard },

    {
      provide: TenantFinder,
      useFactory: (tenants: TenantRepository) => new TenantFinder(tenants),
      inject: [TENANT_REPOSITORY],
    },
    {
      provide: UserFinder,
      useFactory: (users: UserRepository) => new UserFinder(users),
      inject: [USER_REPOSITORY],
    },
    {
      provide: MembershipFinder,
      useFactory: (memberships: MembershipRepository) => new MembershipFinder(memberships),
      inject: [MEMBERSHIP_REPOSITORY],
    },
    {
      provide: RoleFinder,
      useFactory: (roles: RoleRepository) => new RoleFinder(roles),
      inject: [ROLE_REPOSITORY],
    },
    {
      provide: UserRegistrar,
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        ids: IdGenerator,
        clock: Clock,
      ) => new UserRegistrar(users, hasher, ids, clock),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, ID_GENERATOR, CLOCK],
    },
    {
      provide: MemberEnroller,
      useFactory: (memberships: MembershipRepository, ids: IdGenerator, clock: Clock) =>
        new MemberEnroller(memberships, ids, clock),
      inject: [MEMBERSHIP_REPOSITORY, ID_GENERATOR, CLOCK],
    },
    {
      provide: AccessSessionBuilder,
      useFactory: (
        tenants: TenantRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
      ) => new AccessSessionBuilder(tenants, memberships, roles),
      inject: [TENANT_REPOSITORY, MEMBERSHIP_REPOSITORY, ROLE_REPOSITORY],
    },

    {
      provide: UserAuthenticator,
      useFactory: (
        users: UserRepository,
        tenants: TenantRepository,
        memberships: MembershipRepository,
        hasher: PasswordHasher,
        session: AccessSessionBuilder,
        attempts: LoginAttempts,
      ) => new UserAuthenticator(users, tenants, memberships, hasher, session, attempts),
      inject: [
        USER_REPOSITORY,
        TENANT_REPOSITORY,
        MEMBERSHIP_REPOSITORY,
        PASSWORD_HASHER,
        AccessSessionBuilder,
        LOGIN_ATTEMPTS,
      ],
    },
    {
      provide: TenantSwitcher,
      useFactory: (
        users: UserFinder,
        tenants: TenantFinder,
        memberships: MembershipFinder,
        session: AccessSessionBuilder,
      ) => new TenantSwitcher(users, tenants, memberships, session),
      inject: [UserFinder, TenantFinder, MembershipFinder, AccessSessionBuilder],
    },
    {
      provide: UserCreator,
      useFactory: (
        tenants: TenantFinder,
        roles: RoleFinder,
        registrar: UserRegistrar,
        enroller: MemberEnroller,
      ) => new UserCreator(tenants, roles, registrar, enroller),
      inject: [TenantFinder, RoleFinder, UserRegistrar, MemberEnroller],
    },
    {
      provide: RoleAssigner,
      useFactory: (
        finder: MembershipFinder,
        roles: RoleFinder,
        memberships: MembershipRepository,
        clock: Clock,
      ) => new RoleAssigner(finder, roles, memberships, clock),
      inject: [MembershipFinder, RoleFinder, MEMBERSHIP_REPOSITORY, CLOCK],
    },
    { provide: CatalogPermissions, useClass: CatalogPermissions },
    {
      provide: TenantUserUpdater,
      useFactory: (
        memberships: MembershipFinder,
        users: UserFinder,
        roles: RoleFinder,
        userRepository: UserRepository,
        membershipRepository: MembershipRepository,
        clock: Clock,
      ) => new TenantUserUpdater(memberships, users, roles, userRepository, membershipRepository, clock),
      inject: [MembershipFinder, UserFinder, RoleFinder, USER_REPOSITORY, MEMBERSHIP_REPOSITORY, CLOCK],
    },
    {
      provide: MembershipStatusChanger,
      useFactory: (finder: MembershipFinder, memberships: MembershipRepository, clock: Clock) =>
        new MembershipStatusChanger(finder, memberships, clock),
      inject: [MembershipFinder, MEMBERSHIP_REPOSITORY, CLOCK],
    },
    {
      provide: ProfileUpdater,
      useFactory: (finder: UserFinder, users: UserRepository, clock: Clock) =>
        new ProfileUpdater(finder, users, clock),
      inject: [UserFinder, USER_REPOSITORY, CLOCK],
    },
    {
      provide: PasswordChanger,
      useFactory: (
        finder: UserFinder,
        users: UserRepository,
        hasher: PasswordHasher,
        clock: Clock,
      ) => new PasswordChanger(finder, users, hasher, clock),
      inject: [UserFinder, USER_REPOSITORY, PASSWORD_HASHER, CLOCK],
    },
    {
      provide: SessionFinder,
      useFactory: (
        users: UserFinder,
        tenants: TenantFinder,
        memberships: MembershipFinder,
        session: AccessSessionBuilder,
      ) => new SessionFinder(users, tenants, memberships, session),
      inject: [UserFinder, TenantFinder, MembershipFinder, AccessSessionBuilder],
    },
    {
      provide: RoleCreator,
      useFactory: (
        roles: RoleRepository,
        catalog: CatalogPermissions,
        ids: IdGenerator,
        clock: Clock,
      ) => new RoleCreator(roles, catalog, ids, clock),
      inject: [ROLE_REPOSITORY, CatalogPermissions, ID_GENERATOR, CLOCK],
    },
    {
      provide: RoleUpdater,
      useFactory: (
        finder: RoleFinder,
        roles: RoleRepository,
        catalog: CatalogPermissions,
        clock: Clock,
      ) => new RoleUpdater(finder, roles, catalog, clock),
      inject: [RoleFinder, ROLE_REPOSITORY, CatalogPermissions, CLOCK],
    },
    {
      provide: RoleSearcher,
      useFactory: (roles: RoleRepository) => new RoleSearcher(roles),
      inject: [ROLE_REPOSITORY],
    },
    {
      provide: PermissionSearcher,
      useFactory: (catalog: CatalogPermissions) => new PermissionSearcher(catalog),
      inject: [CatalogPermissions],
    },
    {
      provide: RoleRevoker,
      useFactory: (
        finder: MembershipFinder,
        roles: RoleFinder,
        memberships: MembershipRepository,
        clock: Clock,
      ) => new RoleRevoker(finder, roles, memberships, clock),
      inject: [MembershipFinder, RoleFinder, MEMBERSHIP_REPOSITORY, CLOCK],
    },
    {
      provide: UserSearcher,
      useFactory: (
        users: UserRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
      ) => new UserSearcher(users, memberships, roles),
      inject: [USER_REPOSITORY, MEMBERSHIP_REPOSITORY, ROLE_REPOSITORY],
    },
  ],
  exports: [UserCreator, RoleAssigner, UserSearcher, TOKEN_ISSUER],
})
export class AccessModule {}
