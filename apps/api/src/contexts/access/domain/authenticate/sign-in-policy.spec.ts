import { describe, expect, it } from 'vitest';
import { SignInPolicy } from './sign-in-policy.js';
import { InactiveMembershipError } from '../errors/inactive-membership.error.js';
import { InactiveTenantError } from '../errors/inactive-tenant.error.js';
import { InactiveUserError } from '../errors/inactive-user.error.js';
import { aMembership, aTenant, aUser } from '../testing/access.mother.js';

describe('SignInPolicy', () => {
  it('lets an active user into an active tenant with an active membership', () => {
    expect(() =>
      SignInPolicy.ensureCanSignIn(aUser(), aTenant(), aMembership()),
    ).not.toThrow();
  });

  it('rejects a deactivated user', () => {
    expect(() =>
      SignInPolicy.ensureCanSignIn(aUser({ active: false }), aTenant(), aMembership()),
    ).toThrow(InactiveUserError);
  });

  // Suspender la empresa deja fuera a todos sus miembros sin tocar sus membresias.
  it('rejects every member of a suspended tenant', () => {
    expect(() =>
      SignInPolicy.ensureCanSignIn(aUser(), aTenant({ active: false }), aMembership()),
    ).toThrow(InactiveTenantError);
  });

  it('rejects a revoked membership even if user and tenant are active', () => {
    expect(() =>
      SignInPolicy.ensureCanSignIn(aUser(), aTenant(), aMembership({ active: false })),
    ).toThrow(InactiveMembershipError);
  });
});
