import { describe, expect, it } from 'vitest';
import { RoleFinder } from './role-finder.js';
import { RoleNotFoundError } from '../../errors/role-not-found.error.js';
import { ROLE_A, TENANT_A, TENANT_B, aRole } from '../../testing/access.mother.js';
import { InMemoryRoleRepository } from '../../../infrastructure/testing/in-memory-role.repository.js';
import { TenantId } from '../../tenant/tenant-id.vo.js';
import { RoleId } from '../role-id.vo.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const ABSENT = '99999999-9999-4999-8999-999999999999';

const finder = new RoleFinder(
  new InMemoryRoleRepository([aRole(), aRole({ id: OTHER_ROLE, tenantId: TENANT_B })]),
);

describe('RoleFinder', () => {
  it('returns the role of the tenant', async () => {
    expect((await finder.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A))).id.value).toBe(ROLE_A);
  });

  // Existe, pero no para esta empresa: se responde como inexistente, no como prohibido.
  it('treats a role of another tenant as missing', async () => {
    await expect(
      finder.find(TenantId.of(TENANT_A), RoleId.of(OTHER_ROLE)),
    ).rejects.toThrow(RoleNotFoundError);
  });

  it('returns every requested role', async () => {
    expect(await finder.findAll(TenantId.of(TENANT_A), [RoleId.of(ROLE_A)])).toHaveLength(1);
  });

  it('accepts an empty request', async () => {
    expect(await finder.findAll(TenantId.of(TENANT_A), [])).toEqual([]);
  });

  // Todo o nada: si uno falta, no se devuelve la lista a medias.
  it('throws when one of several is missing', async () => {
    await expect(
      finder.findAll(TenantId.of(TENANT_A), [RoleId.of(ROLE_A), RoleId.of(ABSENT)]),
    ).rejects.toThrow(RoleNotFoundError);
  });
});
