import { describe, expect, it } from 'vitest';
import { UserSearcher } from './user-searcher.js';
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

const USER_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';
const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';

function searcherFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new UserSearcher(scenario.users, scenario.memberships, scenario.roles);
}

describe('UserSearcher', () => {
  it('lists the people of the tenant with their roles', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant()],
      roles: [aRole({ name: 'Sales' })],
      memberships: [aMembership({ roleIds: [ROLE_A] })],
    });

    const { users } = await searcherFor(scenario).run({ tenantId: TENANT_A });

    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe(USER_A);
    expect(users[0].roles).toEqual(['Sales']);
  });

  // La prueba que resume el hito: quien pregunta por su empresa no ve la otra.
  it('never leaks a person who only belongs to another tenant', async () => {
    const scenario = anAccessScenario({
      users: [aUser(), aUser({ id: USER_B, email: 'beto@globex.com' })],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [aRole(), aRole({ id: OTHER_ROLE, tenantId: TENANT_B })],
      memberships: [
        aMembership(),
        aMembership({ id: OTHER_MEMBERSHIP, tenantId: TENANT_B, userId: USER_B }),
      ],
    });

    const { users } = await searcherFor(scenario).run({ tenantId: TENANT_A });

    expect(users.map((user) => user.email)).toEqual(['ana@acme.com']);
  });

  // Un rol homonimo de otra empresa no debe aparecer atribuido a esta.
  it('does not attribute a role of another tenant', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [aRole({ id: OTHER_ROLE, tenantId: TENANT_B, name: 'Sales' })],
      memberships: [aMembership({ roleIds: [] })],
    });

    const { users } = await searcherFor(scenario).run({ tenantId: TENANT_A });

    expect(users[0].roles).toEqual([]);
  });

  it('reports a revoked membership without hiding the person', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant()],
      memberships: [aMembership({ active: false })],
    });

    const { users } = await searcherFor(scenario).run({ tenantId: TENANT_A });

    expect(users[0].membershipActive).toBe(false);
    expect(users[0].isActive).toBe(true);
  });

  it('returns an empty list for a tenant with nobody', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    expect(await searcherFor(scenario).run({ tenantId: TENANT_A })).toEqual({ users: [] });
  });

  it('sorts people by email, so the listing is stable', async () => {
    const scenario = anAccessScenario({
      users: [aUser({ email: 'zoe@acme.com' }), aUser({ id: USER_B, email: 'beto@acme.com' })],
      tenants: [aTenant()],
      memberships: [
        aMembership(),
        aMembership({ id: OTHER_MEMBERSHIP, userId: USER_B }),
      ],
    });

    const { users } = await searcherFor(scenario).run({ tenantId: TENANT_A });

    expect(users.map((user) => user.email)).toEqual(['beto@acme.com', 'zoe@acme.com']);
  });
});
