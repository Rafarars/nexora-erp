import { CompanyActivity } from '../../domain/settings/policy/company-activity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Las pruebas declaran que empresas ya confirmaron documentos.
export class InMemoryCompanyActivity implements CompanyActivity {
  readonly tenantsWithDocuments = new Set<string>();

  async hasConfirmedDocuments(tenantId: TenantId): Promise<boolean> {
    return this.tenantsWithDocuments.has(tenantId.value);
  }
}
