import { describe, expect, it } from 'vitest';
import { Membership } from './membership.entity.js';
import { RoleId } from '../role/role-id.vo.js';
import { NOW, ROLE_A, TENANT_A, aMembership } from '../testing/access.mother.js';

const LATER = new Date('2026-02-01T10:00:00.000Z');
const OTHER_ROLE = '66666666-6666-4666-8666-666666666666';

describe('Membership', () => {
  it('is born active and ties a user to a tenant', () => {
    const membership = aMembership();

    expect(membership.isActive()).toBe(true);
    expect(membership.tenantId.value).toBe(TENANT_A);
  });

  it('survives a round trip through primitives', () => {
    const primitives = aMembership({ roleIds: [ROLE_A] }).toPrimitives();

    expect(Membership.fromPrimitives(primitives).toPrimitives()).toEqual(primitives);
  });

  it('assigns a role and reports it', () => {
    const membership = aMembership();

    membership.assignRole(RoleId.of(ROLE_A), LATER);

    expect(membership.hasRole(RoleId.of(ROLE_A))).toBe(true);
    expect(membership.roles()).toHaveLength(1);
  });

  it('ignores assigning the same role twice', () => {
    const membership = aMembership({ roleIds: [ROLE_A] });

    membership.assignRole(RoleId.of(ROLE_A), LATER);

    expect(membership.roles()).toHaveLength(1);
    expect(membership.toPrimitives().updatedAt).toEqual(NOW);
  });

  it('revokes one role leaving the rest', () => {
    const membership = aMembership({ roleIds: [ROLE_A, OTHER_ROLE] });

    membership.revokeRole(RoleId.of(ROLE_A), LATER);

    expect(membership.hasRole(RoleId.of(ROLE_A))).toBe(false);
    expect(membership.hasRole(RoleId.of(OTHER_ROLE))).toBe(true);
  });

  it('replaces the roles with exactly the ones given', () => {
    const membership = aMembership({ roleIds: [ROLE_A] });

    membership.replaceRoles([RoleId.of(OTHER_ROLE)], LATER);

    expect(membership.roles().map((role) => role.value)).toEqual([OTHER_ROLE]);
  });

  // Devolver la lista interna dejaria que quien la recibe la mutara por la espalda.
  it('does not leak its internal role list', () => {
    const membership = aMembership({ roleIds: [ROLE_A] });

    membership.roles().push(RoleId.of(OTHER_ROLE));

    expect(membership.roles()).toHaveLength(1);
  });

  it('can be revoked from a tenant and restored', () => {
    const membership = aMembership();

    membership.revoke(LATER);
    expect(membership.isActive()).toBe(false);

    membership.restore(LATER);
    expect(membership.isActive()).toBe(true);
  });
});
