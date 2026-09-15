import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CatalogUsage } from '../../domain/usage/catalog-usage.js';
import { MeasurementUnitFinder } from '../../domain/measurement-unit/find/measurement-unit-finder.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface MeasurementUnitStatusChangerRequest {
  tenantId: string;
  unitId: string;
  active: boolean;
}

export class MeasurementUnitStatusChanger {
  constructor(
    private readonly finder: MeasurementUnitFinder,
    private readonly usage: CatalogUsage,
    private readonly units: MeasurementUnitRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: MeasurementUnitStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const unit = await this.finder.find(tenantId, MeasurementUnitId.of(request.unitId));

    if (request.active) {
      unit.activate(this.clock.now());
    } else {
      await this.usage.ensureUnitIsUnused(tenantId, unit.id);
      unit.deactivate(this.clock.now());
    }

    await this.units.save(unit);
  }
}
