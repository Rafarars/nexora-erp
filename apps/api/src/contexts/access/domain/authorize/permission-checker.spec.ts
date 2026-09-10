import { describe, expect, it } from 'vitest';
import { PermissionChecker } from './permission-checker.js';
import { PermissionDeniedError } from '../errors/permission-denied.error.js';
import { PermissionCode } from '../role/permission-code.vo.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { TENANT_A, TENANT_B, aRole, anAdminRole } from '../testing/access.mother.js';

const CREATE_INVOICES = PermissionCode.of('sales.invoices.create');
const TENANT = TenantId.of(TENANT_A);

describe('PermissionChecker', () => {
  it('allows what a role of the tenant grants', () => {
    const roles = [aRole({ permissions: ['sales.invoices.create'] })];

    expect(PermissionChecker.can(roles, TENANT, CREATE_INVOICES)).toBe(true);
  });

  // Falla en cerrado: la ausencia de reglas deniega, no permite.
  it('denies when there are no roles at all', () => {
    expect(PermissionChecker.can([], TENANT, CREATE_INVOICES)).toBe(false);
  });

  it('denies a permission no role grants', () => {
    const roles = [aRole({ permissions: ['sales.invoices.read'] })];

    expect(PermissionChecker.can(roles, TENANT, CREATE_INVOICES)).toBe(false);
  });

  it('allows anything to an administrator of the tenant', () => {
    expect(PermissionChecker.can([anAdminRole()], TENANT, CREATE_INVOICES)).toBe(true);
  });

  // El limite de grantsAll: concede todo DENTRO de su empresa, nunca fuera.
  it('denies an administrator of another tenant', () => {
    const roles = [anAdminRole({ tenantId: TENANT_B })];

    expect(PermissionChecker.can(roles, TENANT, CREATE_INVOICES)).toBe(false);
  });

  it('denies a role of another tenant that grants the very same permission', () => {
    const roles = [aRole({ tenantId: TENANT_B, permissions: ['sales.invoices.create'] })];

    expect(PermissionChecker.can(roles, TENANT, CREATE_INVOICES)).toBe(false);
  });

  it('throws when asked to ensure a permission that is denied', () => {
    expect(() => PermissionChecker.ensureCan([], TENANT, CREATE_INVOICES)).toThrow(
      PermissionDeniedError,
    );
    expect(() => PermissionChecker.ensureCan([], TENANT, CREATE_INVOICES)).toThrow(
      /sales.invoices.create/,
    );
  });

  it('lists effective permissions without duplicates and sorted', () => {
    const roles = [
      aRole({ permissions: ['sales.invoices.read', 'sales.invoices.create'] }),
      aRole({ name: 'Support', permissions: ['sales.invoices.read'] }),
      aRole({ tenantId: TENANT_B, permissions: ['other.tenant.permission'] }),
    ];

    expect(PermissionChecker.effectivePermissions(roles, TENANT)).toEqual([
      'sales.invoices.create',
      'sales.invoices.read',
    ]);
  });
});
