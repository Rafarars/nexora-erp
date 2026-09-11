import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Membership } from '../domain/membership/membership.entity.js';
import { MembershipId } from '../domain/membership/membership-id.vo.js';
import { PermissionCode } from '../domain/role/permission-code.vo.js';
import { RoleId } from '../domain/role/role-id.vo.js';
import { RoleName } from '../domain/role/role-name.vo.js';
import { TenantId } from '../domain/tenant/tenant-id.vo.js';
import { TenantSlug } from '../domain/tenant/tenant-slug.vo.js';
import { Email } from '../domain/user/email.vo.js';
import { UserId } from '../domain/user/user-id.vo.js';
import {
  MEMBERSHIP_A,
  NOW,
  ROLE_A,
  TENANT_A,
  TENANT_B,
  USER_A,
  aMembership,
  aRole,
  aTenant,
  aUser,
  anAdminRole,
} from '../domain/testing/access.mother.js';
import { AccessRepositories, AccessRepositoriesHarness } from './access-repositories.harness.js';

const USER_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROLE_B = '88888888-8888-4888-8888-888888888888';
const MEMBERSHIP_B = '77777777-7777-4777-8777-777777777777';
const ABSENT = '99999999-9999-4999-8999-999999999999';


// UNA sola suite, ejecutada dos veces: contra los dobles en memoria y contra el
// adaptador Prisma. Si ambos pasan, los dobles de las 250 pruebas de dominio y
// aplicacion no estan mintiendo sobre como se comporta la base de verdad.
export function describeAccessRepositoriesContract(
  implementation: string,
  createHarness: () => AccessRepositoriesHarness,
): void {
  describe(`AccessRepositories contract: ${implementation}`, () => {
    const harness = createHarness();
    let repos: AccessRepositories;

    beforeEach(async () => {
      await harness.reset();
      repos = harness.repositories();
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    // Las membresias y los roles apuntan a empresas y personas: sin ellas, una base
    // real rechazaria la escritura y el doble la aceptaria. Sembrar siempre iguala.
    async function seedTenantsAndUsers(): Promise<void> {
      await repos.tenants.save(aTenant());
      await repos.tenants.save(aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' }));
      await repos.users.save(aUser());
      await repos.users.save(aUser({ id: USER_B, email: 'beto@globex.com' }));
    }

    describe('TenantRepository', () => {
      it('returns what it saved', async () => {
        await repos.tenants.save(aTenant());

        const found = await repos.tenants.find(TenantId.of(TENANT_A));

        expect(found?.toPrimitives()).toMatchObject({
          id: TENANT_A,
          name: 'Acme',
          slug: 'acme',
          isActive: true,
        });
      });

      it('returns null for a tenant that was never saved', async () => {
        expect(await repos.tenants.find(TenantId.of(ABSENT))).toBeNull();
      });

      it('finds by slug', async () => {
        await repos.tenants.save(aTenant());

        expect((await repos.tenants.findBySlug(TenantSlug.of('acme')))?.id.value).toBe(TENANT_A);
      });

      it('returns null for an unknown slug', async () => {
        expect(await repos.tenants.findBySlug(TenantSlug.of('unknown'))).toBeNull();
      });

      // save() es alta y modificacion: quien llama no decide si la fila existe.
      it('updates instead of duplicating when saving twice', async () => {
        const tenant = aTenant();
        await repos.tenants.save(tenant);

        tenant.suspend(NOW);
        await repos.tenants.save(tenant);

        expect(await repos.tenants.searchAll()).toHaveLength(1);
        expect((await repos.tenants.find(TenantId.of(TENANT_A)))?.isActive()).toBe(false);
      });

      it('lists every tenant', async () => {
        await repos.tenants.save(aTenant());
        await repos.tenants.save(aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' }));

        expect(await repos.tenants.searchAll()).toHaveLength(2);
      });

      it('keeps the dates it was given', async () => {
        await repos.tenants.save(aTenant());

        expect((await repos.tenants.find(TenantId.of(TENANT_A)))?.toPrimitives().createdAt)
          .toBeInstanceOf(Date);
      });
    });

    describe('UserRepository', () => {
      it('returns what it saved', async () => {
        await repos.users.save(aUser());

        expect((await repos.users.find(UserId.of(USER_A)))?.emailAddress().value).toBe(
          'ana@acme.com',
        );
      });

      it('returns null for a user that was never saved', async () => {
        expect(await repos.users.find(UserId.of(ABSENT))).toBeNull();
      });

      it('finds by email', async () => {
        await repos.users.save(aUser());

        expect((await repos.users.findByEmail(Email.of('ana@acme.com')))?.id.value).toBe(USER_A);
      });

      it('returns null for an unknown email', async () => {
        expect(await repos.users.findByEmail(Email.of('nadie@acme.com'))).toBeNull();
      });

      it('updates instead of duplicating when saving twice', async () => {
        const user = aUser();
        await repos.users.save(user);

        user.changeEmail(Email.of('otra@acme.com'), NOW);
        await repos.users.save(user);

        expect(await repos.users.findByEmail(Email.of('ana@acme.com'))).toBeNull();
        expect((await repos.users.find(UserId.of(USER_A)))?.emailAddress().value).toBe(
          'otra@acme.com',
        );
      });

      it('searches several by id', async () => {
        await repos.users.save(aUser());
        await repos.users.save(aUser({ id: USER_B, email: 'beto@globex.com' }));

        expect(await repos.users.searchByIds([UserId.of(USER_A), UserId.of(USER_B)])).toHaveLength(2);
      });

      it('returns an empty list when asked for nothing', async () => {
        expect(await repos.users.searchByIds([])).toEqual([]);
      });

      it('skips ids that do not exist instead of failing', async () => {
        await repos.users.save(aUser());

        expect(await repos.users.searchByIds([UserId.of(USER_A), UserId.of(ABSENT)])).toHaveLength(1);
      });
    });

    describe('RoleRepository', () => {
      beforeEach(seedTenantsAndUsers);

      it('returns what it saved, with its permissions', async () => {
        await repos.roles.save(aRole({ permissions: ['access.users.create'] }));

        const role = await repos.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A));

        expect(role?.grants(PermissionCode.of('access.users.create'))).toBe(true);
      });

      // El aislamiento vive en la firma del puerto, no en la disciplina de quien llama.
      it('does not return a role of another tenant', async () => {
        await repos.roles.save(aRole({ id: ROLE_B, tenantId: TENANT_B }));

        expect(await repos.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_B))).toBeNull();
      });

      it('keeps grantsAll without listing permissions', async () => {
        await repos.roles.save(anAdminRole());

        const admin = await repos.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A));

        expect(admin?.grantsEverything()).toBe(true);
        expect(admin?.permissionCodes()).toEqual([]);
        expect(admin?.grants(PermissionCode.of('anything.not.invented.yet'))).toBe(true);
      });

      it('finds by name inside its tenant', async () => {
        await repos.roles.save(aRole({ name: 'Sales' }));

        expect((await repos.roles.findByName(TenantId.of(TENANT_A), RoleName.of('Sales')))?.id.value)
          .toBe(ROLE_A);
      });

      // Dos empresas pueden tener un rol con el mismo nombre sin pisarse.
      it('does not confuse two roles with the same name in different tenants', async () => {
        await repos.roles.save(aRole({ name: 'Sales' }));
        await repos.roles.save(aRole({ id: ROLE_B, tenantId: TENANT_B, name: 'Sales' }));

        const found = await repos.roles.findByName(TenantId.of(TENANT_B), RoleName.of('Sales'));

        expect(found?.id.value).toBe(ROLE_B);
      });

      it('replaces the permission set when saving again', async () => {
        const role = aRole({ permissions: ['access.users.create', 'access.users.search'] });
        await repos.roles.save(role);

        role.revoke(PermissionCode.of('access.users.create'), NOW);
        await repos.roles.save(role);

        const saved = await repos.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A));

        expect(saved?.permissionCodes().map((code) => code.value)).toEqual([
          'access.users.search',
        ]);
      });

      it('searches by ids within the tenant only', async () => {
        await repos.roles.save(aRole());
        await repos.roles.save(aRole({ id: ROLE_B, tenantId: TENANT_B }));

        const found = await repos.roles.searchByIds(TenantId.of(TENANT_A), [
          RoleId.of(ROLE_A),
          RoleId.of(ROLE_B),
        ]);

        expect(found.map((role) => role.id.value)).toEqual([ROLE_A]);
      });

      it('returns an empty list when asked for no ids', async () => {
        expect(await repos.roles.searchByIds(TenantId.of(TENANT_A), [])).toEqual([]);
      });

      it('lists the roles of a tenant and no others', async () => {
        await repos.roles.save(aRole());
        await repos.roles.save(aRole({ id: ROLE_B, tenantId: TENANT_B }));

        expect(await repos.roles.searchByTenant(TenantId.of(TENANT_A))).toHaveLength(1);
      });
    });

    describe('MembershipRepository', () => {
      beforeEach(async () => {
        await seedTenantsAndUsers();
        await repos.roles.save(aRole());
        await repos.roles.save(aRole({ id: ROLE_B, tenantId: TENANT_A, name: 'Support' }));
      });

      it('returns what it saved, with its roles', async () => {
        await repos.memberships.save(aMembership({ roleIds: [ROLE_A] }));

        const membership = await repos.memberships.findByUser(
          TenantId.of(TENANT_A),
          UserId.of(USER_A),
        );

        expect(membership?.roles().map((role) => role.value)).toEqual([ROLE_A]);
      });

      it('returns null for a user with no membership in the tenant', async () => {
        expect(
          await repos.memberships.findByUser(TenantId.of(TENANT_B), UserId.of(USER_A)),
        ).toBeNull();
      });

      it('does not return a membership of another tenant by id', async () => {
        await repos.memberships.save(aMembership());

        expect(
          await repos.memberships.find(TenantId.of(TENANT_B), MembershipId.of(MEMBERSHIP_A)),
        ).toBeNull();
      });

      it('adds a role without losing the previous one', async () => {
        const membership = aMembership({ roleIds: [ROLE_A] });
        await repos.memberships.save(membership);

        membership.assignRole(RoleId.of(ROLE_B), NOW);
        await repos.memberships.save(membership);

        const saved = await repos.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));

        expect(saved?.roles().map((role) => role.value).sort()).toEqual([ROLE_A, ROLE_B].sort());
      });

      // Guardar reemplaza el conjunto: un rol revocado desaparece de verdad.
      it('removes a revoked role when saving again', async () => {
        const membership = aMembership({ roleIds: [ROLE_A, ROLE_B] });
        await repos.memberships.save(membership);

        membership.revokeRole(RoleId.of(ROLE_A), NOW);
        await repos.memberships.save(membership);

        const saved = await repos.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));

        expect(saved?.roles().map((role) => role.value)).toEqual([ROLE_B]);
      });

      it('keeps a revoked membership readable', async () => {
        const membership = aMembership();
        await repos.memberships.save(membership);

        membership.revoke(NOW);
        await repos.memberships.save(membership);

        const saved = await repos.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));

        expect(saved?.isActive()).toBe(false);
      });

      it('lists the members of a tenant and no others', async () => {
        await repos.memberships.save(aMembership());
        await repos.memberships.save(
          Membership.fromPrimitives({
            ...aMembership({ id: MEMBERSHIP_B, tenantId: TENANT_B, userId: USER_B }).toPrimitives(),
          }),
        );

        expect(await repos.memberships.searchByTenant(TenantId.of(TENANT_A))).toHaveLength(1);
      });

      // Alimenta el selector de empresa: sin filtro por empresa, a proposito.
      it('lists every tenant a person can reach', async () => {
        await repos.memberships.save(aMembership());
        await repos.memberships.save(aMembership({ id: MEMBERSHIP_B, tenantId: TENANT_B }));

        const reachable = await repos.memberships.searchByUser(UserId.of(USER_A));

        expect(reachable.map((membership) => membership.tenantId.value).sort()).toEqual(
          [TENANT_A, TENANT_B].sort(),
        );
      });

      it('returns an empty list for a person with no memberships', async () => {
        expect(await repos.memberships.searchByUser(UserId.of(USER_B))).toEqual([]);
      });
    });
  });
}
