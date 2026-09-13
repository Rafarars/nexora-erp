import { describe, expect, it } from 'vitest';
import { InMemoryTaxRepository } from '../../../infrastructure/testing/in-memory-tax.repository.js';
import { DuplicateTaxNameError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TAX_A, TAX_B, TENANT_A, TENANT_B, aTax } from '../../testing/catalog.mother.js';
import { TaxId } from '../tax-id.vo.js';
import { TaxName } from '../tax-name.vo.js';
import { TaxUniqueness } from './tax-uniqueness.js';

const uniqueness = new TaxUniqueness(new InMemoryTaxRepository([aTax({ name: 'IVA 16%' })]));

describe('TaxUniqueness', () => {
  it('rejects a name already used in the tenant', async () => {
    await expect(uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), TaxName.of('IVA 16%'))).rejects.toThrow(
      DuplicateTaxNameError,
    );
  });

  it('accepts it in another tenant', async () => {
    await expect(uniqueness.ensureNameIsFree(TenantId.of(TENANT_B), TaxName.of('IVA 16%'))).resolves.toBeUndefined();
  });

  it('lets the tax keep its own name', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), TaxName.of('IVA 16%'), TaxId.of(TAX_A)),
    ).resolves.toBeUndefined();
  });

  it('does not let another tax take it', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), TaxName.of('IVA 16%'), TaxId.of(TAX_B)),
    ).rejects.toThrow(DuplicateTaxNameError);
  });
});
