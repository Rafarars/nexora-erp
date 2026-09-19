import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { Quantity } from '../../domain/quantity/quantity.vo.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ExpectedStock } from '../../domain/stock/expected-stock.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';
import { StockWarehouseNotFoundError } from '../../domain/errors/inventory.errors.js';

export interface StockResponse {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  quantity: number;
  // Lo que los pedidos de venta confirmados ya comprometieron.
  reserved: number;
  // Lo que se puede prometer hoy: existencia menos reservado, nunca negativo.
  available: number;
  averageCost: number;
  // Cantidad por costo promedio, con los decimales de la empresa.
  totalValue: number;
}

export interface StockSearcherRequest {
  tenantId: string;
  q?: string | null;
  warehouseId?: string | null;
  includeEmpty?: boolean;
  limit?: number;
  offset?: number;
}

export interface StockSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  // La moneda de la empresa: el costo promedio y el valor van en ella.
  currency: string;
  stocks: StockResponse[];
}

const DEFAULT_PAGE = 20;

export class StockSearcher {
  constructor(
    private readonly stocks: StockRepository,
    private readonly catalog: InventoryCatalog,
    private readonly expected: ExpectedStock,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: StockSearcherRequest): Promise<StockSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    // Filtrar por una bodega de otra empresa responde como en el resto del sistema: no existe.
    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new StockWarehouseNotFoundError(warehouseId.value);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.stocks.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      warehouseId: request.warehouseId ?? null,
      includeEmpty: request.includeEmpty ?? false,
      limit,
      offset,
    });

    const [items, warehouses, pending, decimals, currency] = await Promise.all([
      this.catalog.findItems(tenantId, [...new Map(page.stocks.map((s) => [s.itemId.value, s.itemId])).values()]),
      this.catalog.findWarehouses(tenantId, [...new Map(page.stocks.map((s) => [s.warehouseId.value, s.warehouseId])).values()]),
      this.expected.pending(tenantId, warehouseId),
      this.rates.amountDecimals(request.tenantId),
      this.rates.companyCurrency(request.tenantId),
    ]);

    const reservedBy = new Map(pending.map((row) => [`${row.itemId}|${row.warehouseId}`, row.reserved]));

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + page.stocks.length < page.total,
      currency,
      stocks: page.stocks.map((stock) => {
        const row = stock.toPrimitives();
        const item = items.find((candidate) => candidate.id === row.itemId);
        const reserved = reservedBy.get(`${row.itemId}|${row.warehouseId}`) ?? 0;

        return {
          item: {
            id: row.itemId,
            sku: item?.sku ?? '',
            name: item?.name ?? '',
            baseUnit: item?.units.find((unit) => unit.isBase)?.abbreviation ?? '',
          },
          warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
          quantity: row.quantity,
          reserved,
          // Un ajuste de salida puede sacar mercancia ya comprometida: entonces no queda nada
          // que prometer, pero tampoco se promete en negativo.
          available: Math.max(0, round(row.quantity - reserved)),
          averageCost: row.averageCost,
          totalValue: valueOf(stock.available(), row.averageCost, decimals),
        };
      }),
    };
  }
}

// Lo que vale lo que hay, con los mismos decimales que la empresa usa en sus documentos y en el
// informe de valuacion. Antes se redondeaba a centimos fijos y las dos cifras no coincidian.
function valueOf(quantity: Quantity, averageCost: number, decimals: number): number {
  const scale = BigInt(10 ** decimals);
  const micros = quantity.units * BigInt(Math.round(averageCost * 1_000_000));
  // De diezmilesimas por millonesimas a la escala pedida, redondeando una sola vez.
  const divisor = 10_000_000_000n / scale;

  return Number((micros * 2n + divisor) / (2n * divisor)) / Number(scale);
}

// Las cantidades del inventario llevan cuatro decimales.
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
