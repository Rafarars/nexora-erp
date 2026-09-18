import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { DocumentRateSet } from '../../../../shared/domain/ports/document-rates.js';
import { SalesCatalog, SalesWarehouse, SellableItem } from '../catalog/sales-catalog.js';
import { CustomerId } from '../customer/customer.entity.js';
import { ReservableItem, StockAvailability } from '../order/posting/stock-availability.js';
import { SalesOrderLine, SalesOrderLineId } from '../order/sales-order-line.js';
import { SalesOrder, SalesOrderId } from '../order/sales-order.entity.js';
import { TaxRate, UnitPrice } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

// Los mismos identificadores de empresa, articulos y bodegas que el inventario y compras.
export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const TODAY = '2026-01-15';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const WATER = 'a1111111-1111-4111-8111-111111111111';
export const SERVICE = 'a2222222-2222-4222-8222-222222222222';
export const INACTIVE_ITEM = 'a3333333-3333-4333-8333-333333333333';
// Existe en el maestro pero no se vende: un insumo interno.
export const NOT_TRADED_ITEM = 'a5555555-5555-4555-8555-555555555556';
export const FOREIGN_ITEM = 'a4444444-4444-4444-8444-444444444444';
export const SOAP = 'a5555555-5555-4555-8555-555555555555';

export const PIECE = 'e1111111-1111-4111-8111-111111111111';
export const BOX = 'e2222222-2222-4222-8222-222222222222';
export const KILO = 'e3333333-3333-4333-8333-333333333333';

export const MAIN = 'b1111111-1111-4111-8111-111111111111';
export const NORTH = 'b2222222-2222-4222-8222-222222222222';
export const CLOSED = 'b3333333-3333-4333-8333-333333333333';
export const FOREIGN_WAREHOUSE = 'b4444444-4444-4444-8444-444444444444';

export const CUSTOMER = 'c1111111-1111-4111-8111-111111111111';

// Agua: se cuenta en unidades, se vende en cajas de 24 y paga 16 % de impuesto.
export function sellableItems(): (SellableItem & { tenantId: string })[] {
  const water = [
    { unitId: PIECE, abbreviation: 'un', conversionFactor: 1, isBase: true },
    { unitId: BOX, abbreviation: 'cja', conversionFactor: 24, isBase: false },
  ];
  const kilo = [{ unitId: KILO, abbreviation: 'kg', conversionFactor: 1, isBase: true }];

  return [
    { tenantId: TENANT_A, id: WATER, sku: 'AGUA-500', name: 'Agua', type: 'inventoried', isActive: true, isSellable: true, taxRate: 16, units: water },
    { tenantId: TENANT_A, id: SOAP, sku: 'JABON', name: 'Jabón', type: 'inventoried', isActive: true, isSellable: true, taxRate: 0, units: kilo },
    { tenantId: TENANT_A, id: SERVICE, sku: 'ENTREGA', name: 'Entrega', type: 'service', isActive: true, isSellable: true, taxRate: 16, units: water.slice(0, 1) },
    { tenantId: TENANT_A, id: NOT_TRADED_ITEM, sku: 'SOLO-COMPRA', name: 'Solo compra', type: 'inventoried', isActive: true, isSellable: false, taxRate: 0, units: water.slice(0, 1) },
    { tenantId: TENANT_A, id: INACTIVE_ITEM, sku: 'VIEJO', name: 'Viejo', type: 'inventoried', isActive: false, isSellable: true, taxRate: 0, units: water.slice(0, 1) },
    { tenantId: TENANT_B, id: FOREIGN_ITEM, sku: 'AJENO', name: 'Ajeno', type: 'inventoried', isActive: true, isSellable: true, taxRate: 0, units: water.slice(0, 1) },
  ];
}

export function salesWarehouses(): (SalesWarehouse & { tenantId: string })[] {
  return [
    { tenantId: TENANT_A, id: MAIN, name: 'Principal', isActive: true },
    { tenantId: TENANT_A, id: NORTH, name: 'Norte', isActive: true },
    { tenantId: TENANT_A, id: CLOSED, name: 'Cerrada', isActive: false },
    { tenantId: TENANT_B, id: FOREIGN_WAREHOUSE, name: 'Ajena', isActive: true },
  ];
}

let lineCounter = 0;

// Una linea de agua ya validada: por defecto 10 cajas de 24 a 30 cada una, con 16 %.
export function anOrderLine(
  overrides: { quantity?: number; unit?: string; factor?: number; unitPrice?: number; taxRate?: number; item?: string } = {},
): SalesOrderLine {
  lineCounter += 1;
  const quantity = Quantity.of(overrides.quantity ?? 10);

  return SalesOrderLine.of({
    id: SalesOrderLineId.of(`5a000000-0000-4000-8000-${String(lineCounter).padStart(12, '0')}`),
    lineNumber: lineCounter,
    itemId: ItemRef.of(overrides.item ?? WATER),
    unitId: UnitRef.of(overrides.unit ?? BOX),
    quantity,
    baseQuantity: quantity.times(overrides.factor ?? 24),
    unitPrice: UnitPrice.of(overrides.unitPrice ?? 30),
    taxRate: TaxRate.of(overrides.taxRate ?? 16),
  });
}

export function aDraftOrder(lines: SalesOrderLine[] = [anOrderLine()], id = '5b000000-0000-4000-8000-000000000001'): SalesOrder {
  return SalesOrder.draft(SalesOrderId.of(id), TenantId.of(TENANT_A), 'PED000001', {
    customerId: CustomerId.of(CUSTOMER),
    warehouseId: WarehouseRef.of(MAIN),
    orderDate: SalesDate.of(TODAY),
    notes: null,
    currency: aDocumentCurrency(),
    lines,
  }, NOW, TODAY);
}

export function aConfirmedOrder(lines: SalesOrderLine[] = [anOrderLine()]): SalesOrder {
  const order = aDraftOrder(lines);

  order.confirm(NOW);

  return order;
}

// Existencia y reservas de otros pedidos, en unidad base, por articulo en cualquier bodega. Los
// articulos estan como en el maestro sembrado (caja de 24) salvo lo que la prueba cambie.
export function anAvailability(
  onHand: Record<string, number>,
  reserved: Record<string, number> = {},
  item: Partial<ReservableItem> = {},
): StockAvailability {
  return {
    onHand: (itemId) => Quantity.of(onHand[itemId.value] ?? 0),
    reservedByOthers: (itemId) => Quantity.of(reserved[itemId.value] ?? 0),
    item: () => ({ isActive: true, type: 'inventoried', factorOf: (unitId) => (unitId.value === BOX ? 24 : 1), ...item }),
  };
}

// En dolares, la moneda de la empresa, a 36,50 Bs.
export function aDocumentCurrency(overrides: Partial<DocumentRateSet> = {}): DocumentCurrency {
  return DocumentCurrency.of({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualRate: false, ...overrides });
}

export type { SalesCatalog };
