import { StockWarehouse, StockableItem } from '../catalog/inventory-catalog.js';

// Los mismos identificadores de empresa que en access y en el catalogo.
export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const TODAY = '2026-01-15';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const WATER = 'a1111111-1111-4111-8111-111111111111';
export const SERVICE = 'a2222222-2222-4222-8222-222222222222';
export const INACTIVE_ITEM = 'a3333333-3333-4333-8333-333333333333';
export const FOREIGN_ITEM = 'a4444444-4444-4444-8444-444444444444';

export const PIECE = 'e1111111-1111-4111-8111-111111111111';
export const BOX = 'e2222222-2222-4222-8222-222222222222';
export const KILO = 'e3333333-3333-4333-8333-333333333333';

// Las personas del contrato: una de cada empresa.
export const ANA = '99999999-9999-4999-8999-999999999999';
export const BETO = '88888888-8888-4888-8888-888888888888';

export const PEOPLE = [
  { tenantId: TENANT_A, id: ANA, name: 'Ana Rivas' },
  { tenantId: TENANT_B, id: BETO, name: 'Beto Lugo' },
];

export const MAIN = 'b1111111-1111-4111-8111-111111111111';
export const NORTH = 'b2222222-2222-4222-8222-222222222222';
export const CLOSED = 'b3333333-3333-4333-8333-333333333333';
export const FOREIGN_WAREHOUSE = 'b4444444-4444-4444-8444-444444444444';

// Agua: se cuenta en unidades y se compra en cajas de 24.
export function stockableItems(): (StockableItem & { tenantId: string })[] {
  const water = [
    { unitId: PIECE, abbreviation: 'un', conversionFactor: 1, isBase: true, mustBeWhole: false },
    { unitId: BOX, abbreviation: 'cja', conversionFactor: 24, isBase: false, mustBeWhole: true },
  ];

  return [
    { tenantId: TENANT_A, id: WATER, sku: 'AGUA-500', name: 'Agua', type: 'inventoried', isActive: true, units: water },
    { tenantId: TENANT_A, id: SERVICE, sku: 'ENTREGA', name: 'Entrega', type: 'service', isActive: true, units: water.slice(0, 1) },
    { tenantId: TENANT_A, id: INACTIVE_ITEM, sku: 'VIEJO', name: 'Viejo', type: 'inventoried', isActive: false, units: water.slice(0, 1) },
    { tenantId: TENANT_B, id: FOREIGN_ITEM, sku: 'AJENO', name: 'Ajeno', type: 'inventoried', isActive: true, units: water.slice(0, 1) },
  ];
}

export function stockWarehouses(): (StockWarehouse & { tenantId: string })[] {
  return [
    { tenantId: TENANT_A, id: MAIN, name: 'Principal', isActive: true },
    { tenantId: TENANT_A, id: NORTH, name: 'Norte', isActive: true },
    { tenantId: TENANT_A, id: CLOSED, name: 'Cerrada', isActive: false },
    { tenantId: TENANT_B, id: FOREIGN_WAREHOUSE, name: 'Ajena', isActive: true },
  ];
}
