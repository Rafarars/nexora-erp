import { TenantId } from '../shared/tenant-id.vo.js';

export const TENANT_NAMES = Symbol('TenantNames');

// El nombre con que se registro la empresa, que vive en access. El adaptador lo lee de su tabla.
export interface TenantNames {
  nameOf(tenantId: TenantId): Promise<string>;
}
