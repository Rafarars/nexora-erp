import { describe, expect, it } from 'vitest';
import { MembershipStatusChanger } from './membership-status-changer.js';
import { CannotDeactivateSelfError } from '../../domain/errors/cannot-deactivate-self.error.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { TENANT_A, TENANT_B, USER_A, aMembership, aTenant } from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';

function changerFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new MembershipStatusChanger(scenario.membershipFinder, scenario.memberships, scenario.clock);
}

async function isActive(scenario: ReturnType<typeof anAccessScenario>, tenantId = TENANT_A) {
  return (await scenario.memberships.findByUser(TenantId.of(tenantId), UserId.of(USER_A)))!.isActive();
}

describe('MembershipStatusChanger', () => {
  it('deactivates the person in the tenant', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], memberships: [aMembership()] });

    await changerFor(scenario).run({ tenantId: TENANT_A, actorId: ADMIN, userId: USER_A, active: false });

    expect(await isActive(scenario)).toBe(false);
  });

  it('reactivates a deactivated person', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], memberships: [aMembership({ active: false })] });

    await changerFor(scenario).run({ tenantId: TENANT_A, actorId: ADMIN, userId: USER_A, active: true });

    expect(await isActive(scenario)).toBe(true);
  });

  // Desactivar en una empresa no toca las demas: la cuenta sigue entrando en ellas.
  it('leaves the membership in other tenants untouched', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [aMembership(), aMembership({ id: OTHER_MEMBERSHIP, tenantId: TENANT_B })],
    });

    await changerFor(scenario).run({ tenantId: TENANT_A, actorId: ADMIN, userId: USER_A, active: false });

    expect(await isActive(scenario, TENANT_A)).toBe(false);
    expect(await isActive(scenario, TENANT_B)).toBe(true);
  });

  it('refuses to let someone deactivate themselves', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], memberships: [aMembership()] });

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, actorId: USER_A, userId: USER_A, active: false }),
    ).rejects.toThrow(CannotDeactivateSelfError);

    expect(await isActive(scenario)).toBe(true);
  });

  it('rejects a person who does not belong to the tenant', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, actorId: ADMIN, userId: USER_A, active: false }),
    ).rejects.toThrow(MembershipNotFoundError);
  });
});
