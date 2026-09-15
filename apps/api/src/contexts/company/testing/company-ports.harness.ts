import { CurrencyCatalog } from '../domain/currency/currency-catalog.js';
import { CompanyProfileRepository } from '../domain/profile/company-profile.repository.js';
import { TenantNames } from '../domain/profile/tenant-names.js';
import { CompanySettingsRepository } from '../domain/settings/company-settings.repository.js';
import { CompanyActivity } from '../domain/settings/policy/company-activity.js';

export interface CompanyPorts {
  settings: CompanySettingsRepository;
  profiles: CompanyProfileRepository;
  currencies: CurrencyCatalog;
  names: TenantNames;
  activity: CompanyActivity;
}

// Deja sin datos ni parametros a las dos empresas de prueba, registradas como `Contrato A` y
// `Contrato B`, y sin documentos.
export interface CompanyPortsHarness {
  ports(): CompanyPorts;
  document(tenantId: string, status: 'draft' | 'confirmed'): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
