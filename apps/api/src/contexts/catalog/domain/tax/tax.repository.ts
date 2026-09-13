import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from './tax-id.vo.js';
import { TaxName } from './tax-name.vo.js';
import { Tax } from './tax.entity.js';

export const TAX_REPOSITORY = Symbol('TaxRepository');

export interface TaxRepository {
  save(tax: Tax): Promise<void>;
  find(tenantId: TenantId, id: TaxId): Promise<Tax | null>;
  findByName(tenantId: TenantId, name: TaxName): Promise<Tax | null>;
  searchByTenant(tenantId: TenantId): Promise<Tax[]>;
}
