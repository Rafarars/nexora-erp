import { DocumentRateSet } from '../../../../shared/domain/ports/document-rates.js';
import { PurchaseWarehouse, PurchasableItem } from '../catalog/purchasing-catalog.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { TaxRate, UnitCost } from '../shared/money.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../order/purchase-order-line.js';
import { PurchaseOrder, PurchaseOrderId } from '../order/purchase-order.entity.js';

// Los mismos identificadores de empresa, articulos y bodegas que el inventario.
export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const TODAY = '2026-01-15';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const WATER = 'a1111111-1111-4111-8111-111111111111';
export const SERVICE = 'a2222222-2222-4222-8222-222222222222';
export const INACTIVE_ITEM = 'a3333333-3333-4333-8333-333333333333';
// Existe en el maestro pero no se compra: solo se vende.
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
export const FOREIGN_SUPPLIER = 'f4444444-4444-4444-8444-444444444444';

export const SUPPLIER = 'f1111111-1111-4111-8111-111111111111';

// Agua: se cuenta en unidades, se compra en cajas de 24 y paga 16 % de impuesto.
export function purchasableItems(): (PurchasableItem & { tenantId: string })[] {
  const water = [
    { unitId: PIECE, abbreviation: 'un', conversionFactor: 1, isBase: true, mustBeWhole: false },
    { unitId: BOX, abbreviation: 'cja', conversionFactor: 24, isBase: false, mustBeWhole: true },
  ];
  const kilo = [{ unitId: KILO, abbreviation: 'kg', conversionFactor: 1, isBase: true, mustBeWhole: false }];

  return [
    { tenantId: TENANT_A, id: WATER, sku: 'AGUA-500', name: 'Agua', type: 'inventoried', isActive: true, isPurchasable: true, taxRate: 16, units: water },
    { tenantId: TENANT_A, id: SOAP, sku: 'JABON', name: 'Jabón', type: 'inventoried', isActive: true, isPurchasable: true, taxRate: 0, units: kilo },
    { tenantId: TENANT_A, id: SERVICE, sku: 'ENTREGA', name: 'Entrega', type: 'service', isActive: true, isPurchasable: true, taxRate: 16, units: water.slice(0, 1) },
    { tenantId: TENANT_A, id: NOT_TRADED_ITEM, sku: 'SOLO-VENTA', name: 'Solo venta', type: 'inventoried', isActive: true, isPurchasable: false, taxRate: 0, units: water.slice(0, 1) },
    { tenantId: TENANT_A, id: INACTIVE_ITEM, sku: 'VIEJO', name: 'Viejo', type: 'inventoried', isActive: false, isPurchasable: true, taxRate: 0, units: water.slice(0, 1) },
    { tenantId: TENANT_B, id: FOREIGN_ITEM, sku: 'AJENO', name: 'Ajeno', type: 'inventoried', isActive: true, isPurchasable: true, taxRate: 0, units: water.slice(0, 1) },
  ];
}

export function purchaseWarehouses(): (PurchaseWarehouse & { tenantId: string })[] {
  return [
    { tenantId: TENANT_A, id: MAIN, name: 'Principal', isActive: true },
    { tenantId: TENANT_A, id: NORTH, name: 'Norte', isActive: true },
    { tenantId: TENANT_A, id: CLOSED, name: 'Cerrada', isActive: false },
    { tenantId: TENANT_B, id: FOREIGN_WAREHOUSE, name: 'Ajena', isActive: true },
  ];
}

let lineCounter = 0;

// Una linea de agua ya validada: por defecto 10 cajas de 24 a 12 cada una, con 16 %.
export function anOrderLine(overrides: { quantity?: number; unit?: string; factor?: number; unitCost?: number; taxRate?: number; item?: string } = {}): PurchaseOrderLine {
  lineCounter += 1;
  const quantity = Quantity.of(overrides.quantity ?? 10);

  return PurchaseOrderLine.of({
    id: PurchaseOrderLineId.of(`0c000000-0000-4000-8000-${String(lineCounter).padStart(12, '0')}`),
    lineNumber: lineCounter,
    itemId: ItemRef.of(overrides.item ?? WATER),
    itemSku: 'AGUA-500',
    itemName: 'Agua',
    unitId: UnitRef.of(overrides.unit ?? BOX),
    quantity,
    baseQuantity: quantity.times(overrides.factor ?? 24),
    unitCost: UnitCost.of(overrides.unitCost ?? 12),
    taxRate: TaxRate.of(overrides.taxRate ?? 16),
  });
}

export function aDraftOrder(lines: PurchaseOrderLine[] = [anOrderLine()], id = '0d000000-0000-4000-8000-000000000001'): PurchaseOrder {
  return PurchaseOrder.draft(PurchaseOrderId.of(id), TenantId.of(TENANT_A), 'OC000001', {
    supplierId: SupplierId.of(SUPPLIER),
    warehouseId: WarehouseRef.of(MAIN),
    orderDate: PurchaseDate.of(TODAY),
    expectedDate: null,
    notes: null,
    paymentTermDays: 30,
    lines,
    currency: aDocumentCurrency(),
  }, NOW, TODAY);
}

export function aConfirmedOrder(lines: PurchaseOrderLine[] = [anOrderLine()]): PurchaseOrder {
  const order = aDraftOrder(lines);

  order.confirm(NOW);

  return order;
}

// En dolares, la moneda de la empresa, a 36,50 Bs.
export function aDocumentCurrency(overrides: Partial<DocumentRateSet> = {}): DocumentCurrency {
  return DocumentCurrency.of({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualRate: false, ...overrides });
}
