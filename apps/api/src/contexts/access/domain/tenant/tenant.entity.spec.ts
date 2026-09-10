import { describe, expect, it } from 'vitest';
import { Tenant } from './tenant.entity.js';
import { NOW, aTenant } from '../testing/access.mother.js';

const LATER = new Date('2026-02-01T10:00:00.000Z');

describe('Tenant', () => {
  it('is born active', () => {
    expect(aTenant().isActive()).toBe(true);
  });

  it('survives a round trip through primitives', () => {
    const primitives = aTenant().toPrimitives();

    expect(Tenant.fromPrimitives(primitives).toPrimitives()).toEqual(primitives);
  });

  it('records when it was suspended without touching its creation date', () => {
    const tenant = aTenant();

    tenant.suspend(LATER);

    expect(tenant.isActive()).toBe(false);
    expect(tenant.toPrimitives().updatedAt).toEqual(LATER);
    expect(tenant.toPrimitives().createdAt).toEqual(NOW);
  });
});
