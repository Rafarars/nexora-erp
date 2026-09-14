import { TenantId } from '../shared/tenant-id.vo.js';
import { Customer, CustomerId } from './customer.entity.js';

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  find(tenantId: TenantId, id: CustomerId): Promise<Customer | null>;
  findByName(tenantId: TenantId, name: string): Promise<Customer | null>;
  searchByTenant(tenantId: TenantId): Promise<Customer[]>;
}
