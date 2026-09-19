import { Clock } from '../../../../shared/domain/ports/clock.js';
import { MeasurementUnitFinder } from '../../domain/measurement-unit/find/measurement-unit-finder.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../../domain/measurement-unit/measurement-unit-name.vo.js';
import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { MeasurementUnitUniqueness } from '../../domain/measurement-unit/unique/measurement-unit-uniqueness.js';
import { UnitAbbreviation } from '../../domain/measurement-unit/unit-abbreviation.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface MeasurementUnitUpdaterRequest {
  tenantId: string;
  unitId: string;
  name: string;
  abbreviation: string;  mustBeWhole?: boolean;
}

export class MeasurementUnitUpdater {
  constructor(
    private readonly finder: MeasurementUnitFinder,
    private readonly uniqueness: MeasurementUnitUniqueness,
    private readonly units: MeasurementUnitRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: MeasurementUnitUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const unit = await this.finder.find(tenantId, MeasurementUnitId.of(request.unitId));
    const name = MeasurementUnitName.of(request.name);
    const abbreviation = UnitAbbreviation.of(request.abbreviation);

    await this.uniqueness.ensureIsFree(tenantId, name, abbreviation, unit.id);

    unit.update(name, abbreviation, request.mustBeWhole ?? false, this.clock.now());

    await this.units.save(unit);
  }
}
