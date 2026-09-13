import { TenantId } from '../shared/tenant-id.vo.js';
import { WarehouseId } from './warehouse-id.vo.js';
import { WarehouseName } from './warehouse-name.vo.js';
import { Warehouse } from './warehouse.entity.js';

export const WAREHOUSE_REPOSITORY = Symbol('WarehouseRepository');

export interface WarehouseRepository {
  save(warehouse: Warehouse): Promise<void>;
  // En una sola transaccion: cambiar la bodega por defecto toca dos filas, y quedarse a
  // medias dejaria la empresa con dos o con ninguna.
  saveAll(warehouses: Warehouse[]): Promise<void>;
  find(tenantId: TenantId, id: WarehouseId): Promise<Warehouse | null>;
  findByName(tenantId: TenantId, name: WarehouseName): Promise<Warehouse | null>;
  findDefault(tenantId: TenantId): Promise<Warehouse | null>;
  searchByTenant(tenantId: TenantId): Promise<Warehouse[]>;
}
