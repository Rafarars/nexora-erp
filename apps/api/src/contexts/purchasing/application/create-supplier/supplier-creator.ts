import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PurchasingCodeSequence, purchasingCode } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierDetails, SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';
import { SupplierUniqueness } from '../../domain/supplier/unique/supplier-uniqueness.js';

export interface SupplierCreatorRequest extends SupplierDetails {
  tenantId: string;
}

export class SupplierCreator {
  constructor(
    private readonly uniqueness: SupplierUniqueness,
    private readonly suppliers: SupplierRepository,
    private readonly codes: PurchasingCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: SupplierCreatorRequest): Promise<void> {
    const { tenantId: tenant, ...details } = request;
    const tenantId = TenantId.of(tenant);
    const id = SupplierId.of(this.ids.next());
    const now = this.clock.now();

    // Se valida entero antes de pedir el numero: un alta invalida no gasta correlativo.
    Supplier.create(id, tenantId, purchasingCode('PRV', 0), details, now);
    await this.uniqueness.ensureNameIsFree(tenantId, details.name);

    const code = purchasingCode('PRV', await this.codes.next(tenantId, 'PRV'));

    await this.suppliers.save(Supplier.create(id, tenantId, code, details, now));
  }
}
