import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface MeasurementUnitResponse {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
}

export interface MeasurementUnitSearcherResponse {
  units: MeasurementUnitResponse[];
}

export class MeasurementUnitSearcher {
  constructor(private readonly units: MeasurementUnitRepository) {}

  async run(request: { tenantId: string }): Promise<MeasurementUnitSearcherResponse> {
    const units = await this.units.searchByTenant(TenantId.of(request.tenantId));

    return {
      units: units
        .map((unit) => {
          const { id, code, name, abbreviation, isActive } = unit.toPrimitives();

          return { id, code, name, abbreviation, isActive };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
