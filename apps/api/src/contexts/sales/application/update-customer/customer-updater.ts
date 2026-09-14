import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerFinder } from '../../domain/customer/find/customer-finder.js';
import { CustomerDetails, CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { CustomerUniqueness } from '../../domain/customer/unique/customer-uniqueness.js';

export interface CustomerUpdaterRequest extends CustomerDetails {
  tenantId: string;
  customerId: string;
}

// Las pedidos guardan el identificador del cliente, no su nombre: renombrarlo cambia como
// se leen todas, tambien las viejas.
export class CustomerUpdater {
  constructor(
    private readonly finder: CustomerFinder,
    private readonly uniqueness: CustomerUniqueness,
    private readonly customers: CustomerRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: CustomerUpdaterRequest): Promise<void> {
    const { tenantId: tenant, customerId, ...details } = request;
    const tenantId = TenantId.of(tenant);
    const customer = await this.finder.find(tenantId, CustomerId.of(customerId));

    customer.update(details, this.clock.now());
    await this.uniqueness.ensureNameIsFree(tenantId, customer.name(), customer.id);
    await this.customers.save(customer);
  }
}
