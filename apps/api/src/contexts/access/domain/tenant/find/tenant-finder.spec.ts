import { describe, expect, it } from 'vitest';
import { TenantFinder } from './tenant-finder.js';
import { TenantNotFoundError } from '../../errors/tenant-not-found.error.js';
import { TENANT_A, TENANT_B, aTenant } from '../../testing/access.mother.js';
import { InMemoryTenantRepository } from '../../../infrastructure/testing/in-memory-tenant.repository.js';
import { TenantId } from '../tenant-id.vo.js';

const finder = new TenantFinder(new InMemoryTenantRepository([aTenant()]));

describe('TenantFinder', () => {
  it('returns the tenant when it exists', async () => {
    expect((await finder.find(TenantId.of(TENANT_A))).id.value).toBe(TENANT_A);
  });

  // El repositorio devuelve null; convertirlo en error es el trabajo de este servicio.
  it('throws instead of returning null when it does not', async () => {
    await expect(finder.find(TenantId.of(TENANT_B))).rejects.toThrow(TenantNotFoundError);
  });
});
