import { describe, expect, it } from 'vitest';
import { TenantSwitcher } from './tenant-switcher.js';
import { InactiveMembershipError } from '../../domain/errors/inactive-membership.error.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
import { TenantNotFoundError } from '../../domain/errors/tenant-not-found.error.js';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error.js';
import {
  ROLE_A,
  TENANT_A,
  TENANT_B,
  USER_A,
  aMembership,
  aRole,
  aTenant,
  aUser,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';
const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const ABSENT = '99999999-9999-4999-8999-999999999999';

function scenarioWithTwoTenants() {
  return anAccessScenario({
    users: [aUser()],
    tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
    roles: [
      aRole({ permissions: ['sales.invoices.read'] }),
      aRole({ id: OTHER_ROLE, tenantId: TENANT_B, permissions: ['sales.invoices.create'] }),
    ],
    memberships: [
      aMembership({ roleIds: [ROLE_A] }),
      aMembership({ id: OTHER_MEMBERSHIP, tenantId: TENANT_B, roleIds: [OTHER_ROLE] }),
    ],
  });
}

function switcherFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new TenantSwitcher(
    scenario.userFinder,
    scenario.tenantFinder,
    scenario.membershipFinder,
    scenario.session,
  );
}

describe('TenantSwitcher', () => {
  // La razon de ser del endpoint: los permisos son los de la empresa destino, no los
  // que traia el token anterior.
  it('returns the permissions of the destination tenant, not of the previous one', async () => {
    const session = await switcherFor(scenarioWithTwoTenants()).run({
      userId: USER_A,
      tenantId: TENANT_B,
    });

    expect(session.tenantId).toBe(TENANT_B);
    expect(session.tenantName).toBe('Globex');
    expect(session.permissions).toEqual(['sales.invoices.create']);
  });

  it('lists every tenant the user can reach', async () => {
    const session = await switcherFor(scenarioWithTwoTenants()).run({
      userId: USER_A,
      tenantId: TENANT_A,
    });

    expect(session.availableTenants.map((tenant) => tenant.slug).sort()).toEqual([
      'acme',
      'globex',
    ]);
  });

  it('rejects a tenant the user does not belong to', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [aMembership()],
    });

    await expect(
      switcherFor(scenario).run({ userId: USER_A, tenantId: TENANT_B }),
    ).rejects.toThrow(MembershipNotFoundError);
  });

  it('rejects a tenant that does not exist', async () => {
    await expect(
      switcherFor(scenarioWithTwoTenants()).run({ userId: USER_A, tenantId: ABSENT }),
    ).rejects.toThrow(TenantNotFoundError);
  });

  it('rejects a user that does not exist', async () => {
    await expect(
      switcherFor(scenarioWithTwoTenants()).run({ userId: ABSENT, tenantId: TENANT_A }),
    ).rejects.toThrow(UserNotFoundError);
  });

  it('rejects switching into a tenant where the membership was revoked', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [
        aMembership(),
        aMembership({ id: OTHER_MEMBERSHIP, tenantId: TENANT_B, active: false }),
      ],
    });

    await expect(
      switcherFor(scenario).run({ userId: USER_A, tenantId: TENANT_B }),
    ).rejects.toThrow(InactiveMembershipError);
  });

  it('does not offer a tenant whose membership was revoked', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [
        aMembership(),
        aMembership({ id: OTHER_MEMBERSHIP, tenantId: TENANT_B, active: false }),
      ],
    });

    const session = await switcherFor(scenario).run({ userId: USER_A, tenantId: TENANT_A });

    expect(session.availableTenants.map((tenant) => tenant.slug)).toEqual(['acme']);
  });
});
