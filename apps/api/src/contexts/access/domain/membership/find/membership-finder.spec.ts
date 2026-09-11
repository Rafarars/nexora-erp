import { describe, expect, it } from 'vitest';
import { MembershipFinder } from './membership-finder.js';
import { MembershipNotFoundError } from '../../errors/membership-not-found.error.js';
import { TENANT_A, TENANT_B, USER_A, aMembership } from '../../testing/access.mother.js';
import { InMemoryMembershipRepository } from '../../../infrastructure/testing/in-memory-membership.repository.js';
import { TenantId } from '../../tenant/tenant-id.vo.js';
import { UserId } from '../../user/user-id.vo.js';

const finder = new MembershipFinder(new InMemoryMembershipRepository([aMembership()]));

describe('MembershipFinder', () => {
  it('returns the membership of the user in the tenant', async () => {
    const membership = await finder.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));

    expect(membership.tenantId.value).toBe(TENANT_A);
  });

  // Aislamiento: la misma persona en otra empresa simplemente no tiene membresia.
  it('throws for a tenant where the user has none', async () => {
    await expect(
      finder.findByUser(TenantId.of(TENANT_B), UserId.of(USER_A)),
    ).rejects.toThrow(MembershipNotFoundError);
  });
});
