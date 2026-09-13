import { MeasurementUnitNotFoundError } from '../../errors/not-found.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { MeasurementUnitId } from '../measurement-unit-id.vo.js';
import { MeasurementUnit } from '../measurement-unit.entity.js';
import { MeasurementUnitRepository } from '../measurement-unit.repository.js';

export class MeasurementUnitFinder {
  constructor(private readonly units: MeasurementUnitRepository) {}

  async find(tenantId: TenantId, id: MeasurementUnitId): Promise<MeasurementUnit> {
    const unit = await this.units.find(tenantId, id);

    if (!unit) {
      throw new MeasurementUnitNotFoundError(id.value);
    }

    return unit;
  }

  // Todas o ninguna: si falta una, el articulo no se guarda con las unidades a medias.
  async findAll(tenantId: TenantId, ids: MeasurementUnitId[]): Promise<MeasurementUnit[]> {
    const found = await this.units.searchByIds(tenantId, ids);

    for (const id of ids) {
      if (!found.some((unit) => unit.id.equals(id))) {
        throw new MeasurementUnitNotFoundError(id.value);
      }
    }

    return found;
  }
}
