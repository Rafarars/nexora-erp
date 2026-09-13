import { describe, expect, it } from 'vitest';
import { InMemoryItemRepository } from '../../../infrastructure/testing/in-memory-item.repository.js';
import { DuplicateSkuError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ITEM_A, ITEM_B, TENANT_A, TENANT_B, anItem } from '../../testing/catalog.mother.js';
import { ItemId } from '../item-id.vo.js';
import { Sku } from '../sku.vo.js';
import { SkuUniqueness } from './sku-uniqueness.js';

const uniqueness = new SkuUniqueness(new InMemoryItemRepository([anItem({ sku: 'AGUA-500' })]));

describe('SkuUniqueness', () => {
  // La comparacion ve el SKU ya normalizado: minusculas no esquivan la regla.
  it('rejects the same SKU written in lowercase', async () => {
    await expect(uniqueness.ensureIsFree(TenantId.of(TENANT_A), Sku.of('agua-500'))).rejects.toThrow(DuplicateSkuError);
  });

  it('accepts it in another tenant', async () => {
    await expect(uniqueness.ensureIsFree(TenantId.of(TENANT_B), Sku.of('AGUA-500'))).resolves.toBeUndefined();
  });

  it('lets the item keep its own SKU', async () => {
    await expect(uniqueness.ensureIsFree(TenantId.of(TENANT_A), Sku.of('AGUA-500'), ItemId.of(ITEM_A))).resolves.toBeUndefined();
  });

  it('does not let another item take it', async () => {
    await expect(uniqueness.ensureIsFree(TenantId.of(TENANT_A), Sku.of('AGUA-500'), ItemId.of(ITEM_B))).rejects.toThrow(
      DuplicateSkuError,
    );
  });
});
