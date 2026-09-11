import { describe, expect, it } from 'vitest';
import { MemberEnroller } from './member-enroller.js';
import { DuplicateMembershipError } from '../../errors/duplicate-membership.error.js';
import {
  NOW,
  ROLE_A,
  TENANT_A,
  USER_A,
  aMembership,
  aRole,
  aTenant,
  aUser,
} from '../../testing/access.mother.js';
import { FixedClock } from '../../../infrastructure/testing/fixed-clock.js';
import { InMemoryMembershipRepository } from '../../../infrastructure/testing/in-memory-membership.repository.js';
import { SequentialIdGenerator } from '../../../infrastructure/testing/sequential-id-generator.js';
import { TenantId } from '../../tenant/tenant-id.vo.js';

function enrollerWith(seed: ReturnType<typeof aMembership>[] = []) {
  const memberships = new InMemoryMembershipRepository(seed);

  return {
    memberships,
    enroller: new MemberEnroller(
      memberships,
      new SequentialIdGenerator(),
      new FixedClock(NOW),
    ),
  };
}

describe('MemberEnroller', () => {
  it('ties the person to the tenant with the roles given', async () => {
    const { enroller, memberships } = enrollerWith();

    const membership = await enroller.enroll(aUser(), aTenant(), [aRole()]);

    expect(membership.userId.value).toBe(USER_A);
    expect(membership.tenantId.value).toBe(TENANT_A);
    expect(membership.roles().map((role) => role.value)).toEqual([ROLE_A]);
    expect(await memberships.searchByTenant(TenantId.of(TENANT_A))).toHaveLength(1);
  });

  it('is born active and stamped by the clock', async () => {
    const { enroller } = enrollerWith();

    const membership = await enroller.enroll(aUser(), aTenant(), []);

    expect(membership.isActive()).toBe(true);
    expect(membership.toPrimitives().createdAt).toEqual(NOW);
  });

  it('rejects enrolling the same person twice in the same tenant', async () => {
    const { enroller } = enrollerWith([aMembership()]);

    await expect(enroller.enroll(aUser(), aTenant(), [])).rejects.toThrow(
      DuplicateMembershipError,
    );
  });

  it('writes nothing when it rejects', async () => {
    const { enroller, memberships } = enrollerWith([aMembership()]);

    await expect(enroller.enroll(aUser(), aTenant(), [])).rejects.toThrow();

    expect(await memberships.searchByTenant(TenantId.of(TENANT_A))).toHaveLength(1);
  });
});
