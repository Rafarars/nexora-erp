import { describe, expect, it } from 'vitest';
import { PermissionCode } from './permission-code.vo.js';
import { Role } from './role.entity.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { NOW, TENANT_A, TENANT_B, aRole, anAdminRole } from '../testing/access.mother.js';

const LATER = new Date('2026-02-01T10:00:00.000Z');
const CREATE_INVOICES = PermissionCode.of('sales.invoices.create');
const DELETE_INVOICES = PermissionCode.of('sales.invoices.delete');

describe('Role', () => {
  it('grants only the permissions it lists', () => {
    const role = aRole({ permissions: ['sales.invoices.create'] });

    expect(role.grants(CREATE_INVOICES)).toBe(true);
    expect(role.grants(DELETE_INVOICES)).toBe(false);
  });

  it('survives a round trip through primitives', () => {
    const primitives = aRole({ permissions: ['sales.invoices.create'] }).toPrimitives();

    expect(Role.fromPrimitives(primitives).toPrimitives()).toEqual(primitives);
  });

  // La razon de ser de grantsAll: un permiso que nace manana ya esta cubierto.
  it('grants any permission when it grants all, without listing a single one', () => {
    const admin = anAdminRole();

    expect(admin.grants(CREATE_INVOICES)).toBe(true);
    expect(admin.grants(PermissionCode.of('anything.not.invented.yet'))).toBe(true);
    expect(admin.toPrimitives().permissions).toEqual([]);
  });

  it('belongs to its own tenant and to no other', () => {
    const admin = anAdminRole({ tenantId: TENANT_A });

    expect(admin.belongsTo(TenantId.of(TENANT_A))).toBe(true);
    expect(admin.belongsTo(TenantId.of(TENANT_B))).toBe(false);
  });

  it('ignores granting a permission it already has', () => {
    const role = aRole({ permissions: ['sales.invoices.create'] });

    role.grant(CREATE_INVOICES, LATER);

    expect(role.permissionCodes()).toHaveLength(1);
    expect(role.toPrimitives().updatedAt).toEqual(NOW);
  });

  it('revokes a permission it had', () => {
    const role = aRole({ permissions: ['sales.invoices.create'] });

    role.revoke(CREATE_INVOICES, LATER);

    expect(role.grants(CREATE_INVOICES)).toBe(false);
  });
});
