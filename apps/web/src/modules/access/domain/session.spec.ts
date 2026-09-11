import { describe, expect, it } from 'vitest';
import { belongsToSeveralTenants, can } from './session';
import type { Session } from './session';

function aSession(overrides: Partial<Session> = {}): Session {
  return {
    userId: 'u1',
    name: 'Ana Rivas',
    email: 'ana@acme.com',
    tenantId: 't1',
    tenantName: 'Acme',
    permissions: ['access.users.search'],
    grantsAll: false,
    availableTenants: [{ id: 't1', name: 'Acme', slug: 'acme' }],
    ...overrides,
  };
}

describe('can', () => {
  it('allows a permission the person has', () => {
    expect(can(aSession(), 'access.users.search')).toBe(true);
  });

  it('denies a permission the person does not have', () => {
    expect(can(aSession(), 'access.users.create')).toBe(false);
  });

  // Sin esto la interfaz le esconderia todos los botones al administrador, porque su
  // lista de permisos viaja vacia a proposito.
  it('allows anything to an administrator, whose list is empty', () => {
    const admin = aSession({ permissions: [], grantsAll: true });

    expect(can(admin, 'access.users.create')).toBe(true);
    expect(can(admin, 'anything.not.invented.yet')).toBe(true);
  });

  it('denies everything when there are no permissions and no grantsAll', () => {
    expect(can(aSession({ permissions: [] }), 'access.users.search')).toBe(false);
  });
});

describe('belongsToSeveralTenants', () => {
  it('is false with a single tenant, so the selector stays hidden', () => {
    expect(belongsToSeveralTenants(aSession())).toBe(false);
  });

  it('is true with more than one', () => {
    const session = aSession({
      availableTenants: [
        { id: 't1', name: 'Acme', slug: 'acme' },
        { id: 't2', name: 'Globex', slug: 'globex' },
      ],
    });

    expect(belongsToSeveralTenants(session)).toBe(true);
  });
});
