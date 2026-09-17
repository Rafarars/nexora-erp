import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { ReportCustomer, ReportInvoice, ReportStock } from '../read-model/reporting-read-model.js';

export const NOW = new Date('2026-03-15T10:00:00.000Z');
export const TODAY = '2026-03-15';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const DELTA = 'c1111111-1111-4111-8111-111111111111';
export const OMEGA = 'c2222222-2222-4222-8222-222222222222';
export const MAIN = 'b1111111-1111-4111-8111-111111111111';
export const NORTH = 'b2222222-2222-4222-8222-222222222222';

export function aCustomer(overrides: Partial<ReportCustomer> = {}): ReportCustomer {
  return { id: DELTA, code: 'CLI000001', name: 'Comercial Delta', fiscalId: 'J-40123456-7', paymentTermDays: 15, creditLimit: 1000, ...overrides };
}

// Como la escriben ventas y cobranza, en la moneda del documento: el saldo en la de la empresa lo
// calcula el modelo de lectura.
export type SeedInvoice = Omit<ReportInvoice, 'balance'> & Partial<DocumentCurrencyPrimitives>;

export function anInvoice(overrides: Partial<SeedInvoice> = {}): SeedInvoice {
  return { id: 'f0000000-0000-4000-8000-000000000001', code: 'FAC000001', customerId: DELTA, issueDate: '2026-03-01', dueDate: '2026-03-16', total: 100, paid: 0, ...overrides };
}

export function aStock(overrides: Partial<ReportStock> = {}): ReportStock {
  return { warehouseId: MAIN, warehouseName: 'Principal', itemId: 'a1111111-1111-4111-8111-111111111111', sku: 'AGUA-500', name: 'Agua', baseUnit: 'un', quantity: 288, averageCost: 0.5, ...overrides };
}
