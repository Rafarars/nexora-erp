import { describe, expect, it } from 'vitest';
import { GrantPolicy } from './grant-policy.js';
import { CannotGrantSelfMoreAccessError } from '../errors/cannot-grant-self-more-access.error.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { ROLE_A, TENANT_A, TENANT_B, aRole, anAdminRole } from '../testing/access.mother.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const tenant = TenantId.of(TENANT_A);

const roleWith = (permissions: string[], id = ROLE_A) =>
  aRole({ id, name: `Rol ${id.slice(0, 4)}`, permissions });

describe('GrantPolicy', () => {
  describe('handing out permissions', () => {
    it('lets someone hand out exactly what they have', () => {
      const actor = [roleWith(['access.users.search', 'access.roles.search'])];

      expect(() =>
        GrantPolicy.ensureWithinReach(tenant, actor, ['access.users.search']),
      ).not.toThrow();
    });

    it('refuses a single permission the actor does not have', () => {
      const actor = [roleWith(['access.users.search'])];

      expect(() =>
        GrantPolicy.ensureWithinReach(tenant, actor, ['access.users.search', 'access.users.create']),
      ).toThrow(CannotGrantSelfMoreAccessError);
    });

    // Quien lo concede todo no tiene nada fuera de su alcance.
    it('never gets in the way of an administrator', () => {
      expect(() =>
        GrantPolicy.ensureWithinReach(tenant, [anAdminRole()], ['access.users.create']),
      ).not.toThrow();
    });

    // Un rol de otra empresa no cuenta como alcance.
    it('ignores roles of another tenant', () => {
      const actor = [aRole({ id: OTHER_ROLE, tenantId: TENANT_B, permissions: ['access.users.create'] })];

      expect(() =>
        GrantPolicy.ensureWithinReach(tenant, actor, ['access.users.create']),
      ).toThrow(CannotGrantSelfMoreAccessError);
    });
  });

  describe('handing out roles', () => {
    // La puerta del alta de cuentas: crear una con el rol que lo concede todo y entrar
    // con ella llegaba al mismo sitio que ascenderse uno mismo.
    it('refuses the role that grants everything to someone who does not have it', () => {
      const actor = [roleWith(['access.users.create'])];

      expect(() =>
        GrantPolicy.ensureRolesWithinReach(tenant, actor, [anAdminRole({ id: OTHER_ROLE })]),
      ).toThrow(CannotGrantSelfMoreAccessError);
    });

    it('lets an administrator hand out the role that grants everything', () => {
      expect(() =>
        GrantPolicy.ensureRolesWithinReach(tenant, [anAdminRole()], [anAdminRole({ id: OTHER_ROLE })]),
      ).not.toThrow();
    });

    it('refuses a role carrying permissions the actor lacks', () => {
      const actor = [roleWith(['access.users.create'])];
      const granted = [roleWith(['access.roles.create'], OTHER_ROLE)];

      expect(() => GrantPolicy.ensureRolesWithinReach(tenant, actor, granted)).toThrow(
        CannotGrantSelfMoreAccessError,
      );
    });

    it('lets someone hand out a role that adds nothing they do not have', () => {
      const actor = [roleWith(['access.users.create', 'access.users.search'])];
      const granted = [roleWith(['access.users.search'], OTHER_ROLE)];

      expect(() => GrantPolicy.ensureRolesWithinReach(tenant, actor, granted)).not.toThrow();
    });

    it('lets someone hand out no role at all', () => {
      expect(() =>
        GrantPolicy.ensureRolesWithinReach(tenant, [roleWith(['access.users.create'])], []),
      ).not.toThrow();
    });
  });
});
