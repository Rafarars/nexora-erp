import {
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
} from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { MeasurementUnitId } from '../measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../measurement-unit-name.vo.js';
import { MeasurementUnitRepository } from '../measurement-unit.repository.js';
import { UnitAbbreviation } from '../unit-abbreviation.vo.js';

export class MeasurementUnitUniqueness {
  constructor(private readonly units: MeasurementUnitRepository) {}

  async ensureIsFree(
    tenantId: TenantId,
    name: MeasurementUnitName,
    abbreviation: UnitAbbreviation,
    except?: MeasurementUnitId,
  ): Promise<void> {
    const isOther = (id: MeasurementUnitId) => !(except && id.equals(except));

    const withName = await this.units.findByName(tenantId, name);

    if (withName && isOther(withName.id)) {
      throw new DuplicateMeasurementUnitNameError(name.value, tenantId.value);
    }

    const withAbbreviation = await this.units.findByAbbreviation(tenantId, abbreviation);

    if (withAbbreviation && isOther(withAbbreviation.id)) {
      throw new DuplicateMeasurementUnitAbbreviationError(abbreviation.value, tenantId.value);
    }
  }
}
