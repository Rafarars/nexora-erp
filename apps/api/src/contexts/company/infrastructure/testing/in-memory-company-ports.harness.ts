import { CompanyPorts, CompanyPortsHarness } from '../../testing/company-ports.harness.js';
import { TENANT_A, TENANT_B } from '../../domain/testing/company.mother.js';
import { InMemoryCompanyActivity } from './in-memory-company-activity.js';
import { InMemoryCompanyProfileRepository } from './in-memory-company-profile.repository.js';
import { InMemoryCompanySettingsRepository } from './in-memory-company-settings.repository.js';
import { InMemoryCurrencyCatalog } from './in-memory-currency-catalog.js';
import { InMemoryTenantNames } from './in-memory-tenant-names.js';

export class InMemoryCompanyPortsHarness implements CompanyPortsHarness {
  private current = this.build();

  ports(): CompanyPorts {
    return this.current;
  }

  // Mismo criterio que el adaptador: un borrador no cuenta.
  async document(tenantId: string, status: 'draft' | 'confirmed'): Promise<void> {
    if (status === 'confirmed') this.current.activity.tenantsWithDocuments.add(tenantId);
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): CompanyPorts & { activity: InMemoryCompanyActivity } {
    return {
      settings: new InMemoryCompanySettingsRepository(),
      profiles: new InMemoryCompanyProfileRepository(),
      currencies: new InMemoryCurrencyCatalog(),
      names: new InMemoryTenantNames({ [TENANT_A]: 'Contrato A', [TENANT_B]: 'Contrato B' }),
      activity: new InMemoryCompanyActivity(),
    };
  }
}
