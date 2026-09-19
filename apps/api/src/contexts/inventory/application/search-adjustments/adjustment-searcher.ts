import { AdjustmentStatus, AdjustmentType, adjustmentTypeOf } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { DocumentAuthors } from '../../domain/documents/document-authors.js';
import { StockWarehouseNotFoundError } from '../../domain/errors/inventory.errors.js';
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
  type: AdjustmentType;
  notes: string | null;
  status: AdjustmentStatus;
  // Quien lo registro y quien lo cerro. Null en los anteriores al rastro, y cuando la persona
  // ya no pertenece a la empresa.
  createdBy: string | null;
  closedBy: string | null;
  lines: AdjustmentLineResponse[];
}

export interface AdjustmentSearcherRequest {
  tenantId: string;
  q?: string | null;
  warehouseId?: string | null;
  status?: string | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdjustmentSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  adjustments: AdjustmentResponse[];
}

// Lo que la pantalla ensena sin pedir nada.
const DEFAULT_PAGE = 20;
const STATUSES: AdjustmentStatus[] = ['draft', 'confirmed', 'cancelled'];

// Una pagina del listado, de la mas reciente a la mas vieja, con los nombres de articulos y
// bodegas ya resueltos. Antes traia TODOS los ajustes de la empresa con todas sus lineas y
// ordenaba en memoria: con volumen, eso tumba la pantalla.
export class AdjustmentSearcher {
  constructor(
    private readonly adjustments: AdjustmentRepository,
    private readonly catalog: InventoryCatalog,
    private readonly authors: DocumentAuthors,
  ) {}

  async run(request: AdjustmentSearcherRequest): Promise<AdjustmentSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por una bodega de otra empresa responde 404, no una lista vacia: tratar lo
    // ajeno como inexistente es lo mismo que hacen existencias y bajo minimo.
    if (request.warehouseId) {
      const warehouse = WarehouseRef.of(request.warehouseId);

      if ((await this.catalog.findWarehouses(tenantId, [warehouse])).length === 0) {
        throw new StockWarehouseNotFoundError(warehouse.value);
      }
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.adjustments.search(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      warehouseId: request.warehouseId ?? null,
      status: STATUSES.find((candidate) => candidate === request.status) ?? null,
      type: request.type ? adjustmentTypeOf(request.type) : null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const adjustments = page.adjustments.map((adjustment) => adjustment.toPrimitives());

    const itemIds = [...new Set(adjustments.flatMap((a) => a.lines.map((line) => line.itemId)))].map((id) => ItemRef.of(id));
    const warehouseIds = [...new Set(adjustments.map((a) => a.warehouseId))].map((id) => WarehouseRef.of(id));
    const closerOf = (adjustment: (typeof adjustments)[number]) =>
      adjustment.status === 'cancelled' ? adjustment.cancelledBy : adjustment.confirmedBy;
    const authorIds = [
      ...new Set(adjustments.flatMap((a) => [a.createdBy, closerOf(a)]).filter((id): id is string => id !== null)),
    ];

    const [items, warehouses, authors] = await Promise.all([
      this.catalog.findItems(tenantId, itemIds),
      this.catalog.findWarehouses(tenantId, warehouseIds),
      this.authors.namesOf(tenantId, authorIds),
    ]);

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + adjustments.length < page.total,
      adjustments: adjustments.map((adjustment) => ({
        id: adjustment.id,
        code: adjustment.code,
        warehouse: { id: adjustment.warehouseId, name: warehouses.find((w) => w.id === adjustment.warehouseId)?.name ?? '' },
        date: adjustment.adjustmentDate,
        type: adjustment.type,
        notes: adjustment.notes,
        status: adjustment.status,
        createdBy: adjustment.createdBy ? (authors.get(adjustment.createdBy) ?? null) : null,
        closedBy: closerOf(adjustment) ? (authors.get(closerOf(adjustment)!) ?? null) : null,
        lines: adjustment.lines.map((line) => {
          const item = items.find((candidate) => candidate.id === line.itemId);

          return {
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            sku: line.itemSku,
            itemName: line.itemName,
            unitId: line.unitId,
            unitAbbreviation: item?.units.find((unit) => unit.unitId === line.unitId)?.abbreviation ?? '',
            direction: line.direction,
            quantity: line.quantity,
            baseQuantity: line.baseQuantity,
            unitCost: line.unitCost,
          };
        }),
      })),
    };
  }
}
