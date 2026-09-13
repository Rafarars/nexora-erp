import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { CatalogCode } from '../../domain/shared/catalog-code.vo.js';
import { CodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { DefaultWarehouse } from '../../domain/warehouse/default/default-warehouse.js';
import { WarehouseUniqueness } from '../../domain/warehouse/unique/warehouse-uniqueness.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { WarehouseName } from '../../domain/warehouse/warehouse-name.vo.js';
import { Warehouse } from '../../domain/warehouse/warehouse.entity.js';

export interface WarehouseCreatorRequest {
  tenantId: string;
  name: string;
  address?: string | null;
}

export class WarehouseCreator {
  constructor(
    private readonly defaults: DefaultWarehouse,
    private readonly uniqueness: WarehouseUniqueness,
    private readonly codes: CodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: WarehouseCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const name = WarehouseName.of(request.name);

    await this.uniqueness.ensureNameIsFree(tenantId, name);

    const code = CatalogCode.fromSequence(Warehouse.CODE_PREFIX, await this.codes.next(tenantId, Warehouse.CODE_PREFIX));
    const now = this.clock.now();

    await this.defaults.register(
      Warehouse.create(WarehouseId.of(this.ids.next()), tenantId, code, name, request.address ?? null, now),
      now,
    );
  }
}
