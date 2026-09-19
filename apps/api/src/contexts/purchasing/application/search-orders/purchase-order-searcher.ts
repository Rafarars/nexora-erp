import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { PurchaseWarehouseNotFoundError, SupplierNotFoundError } from '../../domain/errors/purchasing.errors.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { PurchaseOrderStatus } from '../../domain/order/purchase-order.entity.js';
import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';

export interface PurchaseOrderLineResponse {
  id: string;
  lineNumber: number;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  taxRate: number;
  receivedQuantity: number;
  pendingQuantity: number;
  // Un servicio no se recibe: sin esto la pantalla lo ofrecia igual y la API lo rechazaba.
  movesStock: boolean;
  subtotal: number;
}

export interface PurchaseOrderResponse extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  expectedDate: string | null;
  // Lo decide el hoy de la empresa, en su zona horaria, igual que en En camino.
  late: boolean;
  notes: string | null;
  // El plazo que se pacto, no el que el proveedor tenga hoy.
  paymentTermDays: number;
  status: PurchaseOrderStatus;
  totals: { subtotal: number; tax: number; total: number };
  lines: PurchaseOrderLineResponse[];
}

export interface PurchaseOrderSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  orders: PurchaseOrderResponse[];
}

const DEFAULT_PAGE = 20;

// Las mas recientes primero, con proveedor, bodega y articulos resueltos y lo pendiente de
// cada linea a la vista.
export class PurchaseOrderSearcher {
  constructor(
    private readonly orders: PurchaseOrderRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalog: PurchasingCatalog,
    private readonly rates: DocumentRates,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    supplierId?: string | null;
    warehouseId?: string | null;
    status?: PurchaseOrderStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<PurchaseOrderSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por algo de otra empresa responde como en el resto del sistema: no existe. Una
    // lista vacia diria que ese proveedor no tiene ordenes, que es una respuesta distinta.
    if (request.supplierId) await this.suppliers.find(tenantId, SupplierId.of(request.supplierId)).then(ensureFound(request.supplierId));
    if (request.warehouseId) {
      const found = await this.catalog.findWarehouses(tenantId, [WarehouseRef.of(request.warehouseId)]);

      if (found.length === 0) throw new PurchaseWarehouseNotFoundError(request.warehouseId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.orders.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      supplierId: request.supplierId ?? null,
      warehouseId: request.warehouseId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const orders = page.orders;
    const rows = orders.map((order) => order.toPrimitives());

    const [suppliers, items, warehouses, decimals, today] = await Promise.all([
      this.suppliers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((o) => o.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((o) => o.warehouseId))].map((id) => WarehouseRef.of(id))),
      this.rates.amountDecimals(request.tenantId),
      this.calendar.today(request.tenantId),
    ]);

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + orders.length < page.total,
      orders: orders
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((order) => {
          const row = order.toPrimitives();

          return {
            id: row.id,
            code: row.code,
            supplier: { id: row.supplierId, name: suppliers.find((s) => s.id.value === row.supplierId)?.name() ?? '' },
            warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
            date: row.orderDate,
            expectedDate: row.expectedDate,
            // Solo una orden que todavia espera mercancia puede ir atrasada.
            late: row.expectedDate !== null && row.expectedDate < today && order.isReceivable(),
            notes: row.notes,
            paymentTermDays: row.paymentTermDays,
            status: row.status,
            ...order.currency().toPrimitives(),
            totals: order.totals(decimals),
            lines: order.lines().map((line) => {
              const item = items.find((candidate) => candidate.id === line.itemId.value);
              const { id, lineNumber, itemId, unitId, quantity, baseQuantity, unitCost, taxRate, receivedQuantity } = line.toPrimitives();

              return {
                id,
                lineNumber,
                itemId,
                // Lo que la linea copio al escribirse: renombrar el articulo no cambia el documento.
                sku: line.itemSku,
                itemName: line.itemName,
                unitId,
                unitAbbreviation: item?.units.find((unit) => unit.unitId === unitId)?.abbreviation ?? '',
                quantity,
                baseQuantity,
                unitCost,
                taxRate,
                receivedQuantity,
                pendingQuantity: line.pending().toNumber(),
                movesStock: line.movesStock,
                subtotal: unitsToNumber(line.subtotalUnits(decimals)),
              };
            }),
          };
        }),
    };
  }
}

// Un proveedor que no es de la empresa no existe para ella.
function ensureFound(id: string) {
  return (supplier: unknown) => {
    if (!supplier) throw new SupplierNotFoundError(id);
  };
}
