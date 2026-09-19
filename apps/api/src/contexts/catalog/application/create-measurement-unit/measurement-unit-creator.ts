import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../../domain/measurement-unit/measurement-unit-name.vo.js';
import { MeasurementUnit } from '../../domain/measurement-unit/measurement-unit.entity.js';
import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { MeasurementUnitUniqueness } from '../../domain/measurement-unit/unique/measurement-unit-uniqueness.js';
import { UnitAbbreviation } from '../../domain/measurement-unit/unit-abbreviation.vo.js';
import { CatalogCode } from '../../domain/shared/catalog-code.vo.js';
import { CodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface MeasurementUnitCreatorRequest {
  tenantId: string;
  name: string;
  abbreviation: string;  mustBeWhole?: boolean;
}

export class MeasurementUnitCreator {
  constructor(
    private readonly units: MeasurementUnitRepository,
    private readonly uniqueness: MeasurementUnitUniqueness,
    private readonly codes: CodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: MeasurementUnitCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const name = MeasurementUnitName.of(request.name);
    const abbreviation = UnitAbbreviation.of(request.abbreviation);

    await this.uniqueness.ensureIsFree(tenantId, name, abbreviation);

    const prefix = MeasurementUnit.CODE_PREFIX;
    const code = CatalogCode.fromSequence(prefix, await this.codes.next(tenantId, prefix));

    await this.units.save(
      MeasurementUnit.create(MeasurementUnitId.of(this.ids.next()), tenantId, code, name, abbreviation, request.mustBeWhole ?? false, this.clock.now()),
    );
  }
}
