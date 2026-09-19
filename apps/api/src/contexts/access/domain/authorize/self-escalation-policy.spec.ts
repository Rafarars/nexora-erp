import { describe, expect, it } from 'vitest';
import { SelfEscalationPolicy } from './self-escalation-policy.js';
import { CannotGrantSelfMoreAccessError } from '../errors/cannot-grant-self-more-access.error.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { ROLE_A, TENANT_A, TENANT_B, aRole, anAdminRole } from '../testing/access.mother.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const tenant = TenantId.of(TENANT_A);

const roleWith = (permissions: string[], id = ROLE_A) =>
  aRole({ id, name: `Rol ${id.slice(0, 4)}`, permissions });

describe('SelfEscalationPolicy', () => {
  it('lets someone keep exactly what they had', () => {
    const current = [roleWith(['access.users.search'])];

    expect(() => SelfEscalationPolicy.ensureGrantsNothingNew(tenant, current, current)).not.toThrow();
  });

  it('lets someone give up permissions', () => {
    const current = [roleWith(['access.users.search', 'access.roles.search'])];
    const next = [roleWith(['access.users.search'], OTHER_ROLE)];

    expect(() => SelfEscalationPolicy.ensureGrantsNothingNew(tenant, current, next)).not.toThrow();
  });

  it('refuses a single permission that was not there before', () => {
    const current = [roleWith(['access.users.search'])];
    const next = [roleWith(['access.users.search', 'sales.invoices.create'], OTHER_ROLE)];

    expect(() => SelfEscalationPolicy.ensureGrantsNothingNew(tenant, current, next)).toThrow(
      CannotGrantSelfMoreAccessError,
    );
  });

  // El caso que se reprodujo contra la API: el permiso de repartir roles valia por todos.
  it('refuses the role that grants everything', () => {
    const current = [roleWith(['access.roles.assign'])];

    expect(() =>
      SelfEscalationPolicy.ensureGrantsNothingNew(tenant, current, [anAdminRole({ id: OTHER_ROLE })]),
    ).toThrow(CannotGrantSelfMoreAccessError);
  });

  // Quien ya lo tiene todo no puede ganar nada: no hay a que ascender.
  it('never gets in the way of an administrator', () => {
    const current = [anAdminRole()];
    const next = [anAdminRole(), roleWith(['sales.invoices.create'], OTHER_ROLE)];

    expect(() => SelfEscalationPolicy.ensureGrantsNothingNew(tenant, current, next)).not.toThrow();
  });

  // Un rol de otra empresa no cuenta ni para lo que tenia ni para lo que gana.
  it('ignores roles of another tenant on both sides', () => {
    const current = [aRole({ id: OTHER_ROLE, tenantId: TENANT_B, permissions: ['sales.invoices.create'] })];
    const next = [roleWith(['sales.invoices.create'])];

    expect(() => SelfEscalationPolicy.ensureGrantsNothingNew(tenant, current, next)).toThrow(
      CannotGrantSelfMoreAccessError,
    );
  });
});
