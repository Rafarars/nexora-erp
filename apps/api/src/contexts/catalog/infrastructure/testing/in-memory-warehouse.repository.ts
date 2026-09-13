import { ensureUniqueCode } from './unique-code.js';
import { DuplicateWarehouseNameError } from '../../domain/errors/duplicate.errors.js';
import { ConcurrentDefaultWarehouseError } from '../../domain/errors/warehouse.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { WarehouseName } from '../../domain/warehouse/warehouse-name.vo.js';
import { Warehouse, WarehousePrimitives } from '../../domain/warehouse/warehouse.entity.js';
import { WarehouseRepository } from '../../domain/warehouse/warehouse.repository.js';

export class InMemoryWarehouseRepository implements WarehouseRepository {
  private rows = new Map<string, WarehousePrimitives>();

  constructor(seed: Warehouse[] = []) {
    seed.forEach((warehouse) => this.rows.set(warehouse.id.value, warehouse.toPrimitives()));
  }

  async save(warehouse: Warehouse): Promise<void> {
    await this.saveAll([warehouse]);
  }

  // Todo o nada, como la transaccion de la base: se valida sobre una copia y solo se
  // publica si ninguna fila choca.
  async saveAll(warehouses: Warehouse[]): Promise<void> {
    const next = new Map(this.rows);

    for (const warehouse of warehouses) {
      next.set(warehouse.id.value, warehouse.toPrimitives());
    }

    for (const warehouse of warehouses) {
      const row = warehouse.toPrimitives();
      ensureUniqueCode([...next.values()], row);
      const clash = [...next.values()].find(
        (other) => other.id !== row.id && other.tenantId === row.tenantId && other.name === row.name,
      );

      if (clash) throw new DuplicateWarehouseNameError(row.name, row.tenantId);

      // El indice parcial de la base: una sola bodega por defecto por empresa.
      const defaults = [...next.values()].filter((other) => other.tenantId === row.tenantId && other.isDefault);

      if (defaults.length > 1) throw new ConcurrentDefaultWarehouseError(row.tenantId);
    }

    this.rows = next;
  }

  async find(tenantId: TenantId, id: WarehouseId): Promise<Warehouse | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? Warehouse.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: WarehouseName): Promise<Warehouse | null> {
    const row = this.ofTenant(tenantId).find((candidate) => candidate.name === name.value);

    return row ? Warehouse.fromPrimitives(row) : null;
  }

  async findDefault(tenantId: TenantId): Promise<Warehouse | null> {
    const row = this.ofTenant(tenantId).find((candidate) => candidate.isDefault);

    return row ? Warehouse.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Warehouse[]> {
    return this.ofTenant(tenantId).map((row) => Warehouse.fromPrimitives(row));
  }

  private ofTenant(tenantId: TenantId): WarehousePrimitives[] {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
