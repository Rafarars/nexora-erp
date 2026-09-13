import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface AdjustmentLineResponse {
  lineNumber: number;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  direction: 'in' | 'out';
  quantity: number;
  baseQuantity: number;
  unitCost: number | null;
}

export interface AdjustmentResponse {
  id: string;
  code: string;
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  lines: AdjustmentLineResponse[];
}

// Los mas recientes primero, con los nombres del catalogo ya resueltos.
export class AdjustmentSearcher {
  constructor(
    private readonly adjustments: AdjustmentRepository,
    private readonly catalog: InventoryCatalog,
  ) {}

  async run(request: { tenantId: string }): Promise<{ adjustments: AdjustmentResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const adjustments = (await this.adjustments.searchByTenant(tenantId)).map((adjustment) => adjustment.toPrimitives());

    const itemIds = [...new Set(adjustments.flatMap((a) => a.lines.map((line) => line.itemId)))].map((id) => ItemRef.of(id));
    const warehouseIds = [...new Set(adjustments.map((a) => a.warehouseId))].map((id) => WarehouseRef.of(id));
    const [items, warehouses] = await Promise.all([
      this.catalog.findItems(tenantId, itemIds),
      this.catalog.findWarehouses(tenantId, warehouseIds),
    ]);

    return {
      adjustments: adjustments
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((adjustment) => ({
          id: adjustment.id,
          code: adjustment.code,
          warehouse: { id: adjustment.warehouseId, name: warehouses.find((w) => w.id === adjustment.warehouseId)?.name ?? '' },
          date: adjustment.adjustmentDate,
          notes: adjustment.notes,
          status: adjustment.status,
          lines: adjustment.lines.map((line) => {
            const item = items.find((candidate) => candidate.id === line.itemId);

            return {
              ...line,
              sku: item?.sku ?? '',
              itemName: item?.name ?? '',
              unitAbbreviation: item?.units.find((unit) => unit.unitId === line.unitId)?.abbreviation ?? '',
            };
          }),
        })),
    };
  }
}
