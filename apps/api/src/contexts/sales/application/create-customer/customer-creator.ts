import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Customer, CustomerDetails, CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { CustomerUniqueness } from '../../domain/customer/unique/customer-uniqueness.js';

export interface CustomerCreatorRequest extends CustomerDetails {
  tenantId: string;
}

export class CustomerCreator {
  constructor(
    private readonly uniqueness: CustomerUniqueness,
    private readonly customers: CustomerRepository,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: CustomerCreatorRequest): Promise<void> {
    const { tenantId: tenant, ...details } = request;
    const tenantId = TenantId.of(tenant);
    const id = CustomerId.of(this.ids.next());
    const now = this.clock.now();

    // Se valida entero antes de pedir el numero: un alta invalida no gasta correlativo.
    Customer.create(id, tenantId, salesCode('CLI', 0), details, now);
    await this.uniqueness.ensureNameIsFree(tenantId, details.name);

    const code = salesCode('CLI', await this.codes.next(tenantId, 'CLI'));

    await this.customers.save(Customer.create(id, tenantId, code, details, now));
  }
}
