import { describe, expect, it } from 'vitest';
import { TaxNotFoundError } from '../../domain/errors/not-found.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TAX_A, TENANT_A, TENANT_B, aTax } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { TaxUpdater } from './tax-updater.js';

const updaterFor = (s: CatalogScenario) => new TaxUpdater(s.taxFinder, s.taxUniqueness, s.taxes, s.clock);

describe('TaxUpdater', () => {
  // Los documentos copiaran el porcentaje al confirmarse: cambiarlo con articulos que lo
  // usan es legitimo.
  it('changes the rate even when items use the tax', async () => {
    const scenario = aCatalogScenario({ taxes: [aTax({ rate: 16 })] });
    scenario.itemUsage.add({ taxId: TAX_A });

    await updaterFor(scenario).run({ tenantId: TENANT_A, taxId: TAX_A, name: 'IVA 15%', rate: 15 });

    expect((await scenario.taxes.find(TenantId.of(TENANT_A), TaxId.of(TAX_A)))?.toPrimitives().rate).toBe(15);
  });

  it('cannot reach a tax of another tenant', async () => {
    const scenario = aCatalogScenario({ taxes: [aTax({ tenantId: TENANT_B })] });

    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, taxId: TAX_A, name: 'Colado', rate: 0 })).rejects.toThrow(
      TaxNotFoundError,
    );
  });
});
