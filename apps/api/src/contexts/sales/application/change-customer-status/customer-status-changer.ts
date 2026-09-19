import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerFinder } from '../../domain/customer/find/customer-finder.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { CustomerUsage } from '../../domain/customer/usage/customer-usage.js';
import { CustomerWithOpenOrdersError } from '../../domain/errors/sales.errors.js';

// Desactivar impide los pedidos nuevos y la confirmacion de sus borradores. Lo que no se permite
// es cerrarlo con mercancia por salir: esos pedidos se quedarian sin quien los cierre.
export class CustomerStatusChanger {
  constructor(
    private readonly finder: CustomerFinder,
    private readonly usage: CustomerUsage,
    private readonly customers: CustomerRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; customerId: string; active: boolean }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const customer = await this.finder.find(tenantId, CustomerId.of(request.customerId));

    if (request.active) {
      customer.activate(this.clock.now());
    } else {
      customer.deactivate(this.clock.now());

      if (await this.usage.hasOpenOrders(tenantId, customer.id)) {
        throw new CustomerWithOpenOrdersError(customer.id.value);
      }
    }

    await this.customers.save(customer);
  }
}
