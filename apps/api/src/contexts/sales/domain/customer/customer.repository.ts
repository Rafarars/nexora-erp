import { TenantId } from '../shared/tenant-id.vo.js';
import { Customer, CustomerId } from './customer.entity.js';

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');

// Lo que la pantalla de clientes ofrece. `text` busca por codigo, nombre e identificacion
// fiscal, que es por lo que alguien busca a un cliente.
export interface CustomerCriteria {
  text: string | null;
  // Nulo trae activos e inactivos: los selectores piden solo activos.
  isActive: boolean | null;
  limit: number;
  offset: number;
}

export interface CustomerPage {
  customers: Customer[];
  total: number;
}

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  find(tenantId: TenantId, id: CustomerId): Promise<Customer | null>;
  findByName(tenantId: TenantId, name: string): Promise<Customer | null>;
  searchByTenant(tenantId: TenantId): Promise<Customer[]>;
  searchPage(tenantId: TenantId, criteria: CustomerCriteria): Promise<CustomerPage>;
}
