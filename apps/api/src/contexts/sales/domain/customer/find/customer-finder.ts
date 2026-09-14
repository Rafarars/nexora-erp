import { CustomerNotFoundError } from '../../errors/sales.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Customer, CustomerId } from '../customer.entity.js';
import { CustomerRepository } from '../customer.repository.js';

export class CustomerFinder {
  constructor(private readonly customers: CustomerRepository) {}

  async find(tenantId: TenantId, id: CustomerId): Promise<Customer> {
    const customer = await this.customers.find(tenantId, id);

    if (!customer) throw new CustomerNotFoundError(id.value);

    return customer;
  }
}
