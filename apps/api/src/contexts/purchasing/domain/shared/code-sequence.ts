import { TenantId } from './tenant-id.vo.js';

export const PURCHASING_CODE_SEQUENCE = Symbol('PurchasingCodeSequence');

export type PurchasingCodePrefix = 'PRV' | 'OC' | 'ENT';

// Mismo contrato que el del catalogo y el inventario, declarado aqui para no depender de
// ellos: numero siguiente, atomico, por empresa y prefijo.
export interface PurchasingCodeSequence {
  next(tenantId: TenantId, prefix: PurchasingCodePrefix): Promise<number>;
}

export function purchasingCode(prefix: PurchasingCodePrefix, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}
