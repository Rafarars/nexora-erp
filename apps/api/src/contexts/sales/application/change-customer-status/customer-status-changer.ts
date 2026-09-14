import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerFinder } from '../../domain/customer/find/customer-finder.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';

// Desactivar no toca los pedidos que ya tiene: impide las nuevas y la confirmacion de sus
// borradores, que se revalidan al confirmar.
export class CustomerStatusChanger {
  constructor(
    private readonly finder: CustomerFinder,
    private readonly customers: CustomerRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; customerId: string; active: boolean }): Promise<void> {
    const customer = await this.finder.find(TenantId.of(request.tenantId), CustomerId.of(request.customerId));

    if (request.active) {
      customer.activate(this.clock.now());
    } else {
      customer.deactivate(this.clock.now());
    }

    await this.customers.save(customer);
  }
}
