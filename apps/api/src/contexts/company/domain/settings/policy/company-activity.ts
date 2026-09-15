import { TenantId } from '../../shared/tenant-id.vo.js';

export const COMPANY_ACTIVITY = Symbol('CompanyActivity');

// Lo que la empresa necesita saber de los documentos, sin importar esos contextos: el adaptador lo
// pregunta a sus tablas.
export interface CompanyActivity {
  // Un documento que ya no es borrador escribio importes en la moneda de ese momento.
  hasConfirmedDocuments(tenantId: TenantId): Promise<boolean>;
}
