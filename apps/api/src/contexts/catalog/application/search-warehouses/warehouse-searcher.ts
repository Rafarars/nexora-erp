import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseRepository } from '../../domain/warehouse/warehouse.repository.js';

export interface WarehouseResponse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface WarehouseSearcherResponse {
  warehouses: WarehouseResponse[];
}

export class WarehouseSearcher {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async run(request: { tenantId: string }): Promise<WarehouseSearcherResponse> {
    const warehouses = await this.warehouses.searchByTenant(TenantId.of(request.tenantId));

    return {
      warehouses: warehouses
        .map((warehouse) => {
          const { id, code, name, address, isDefault, isActive } = warehouse.toPrimitives();

          return { id, code, name, address, isDefault, isActive };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
