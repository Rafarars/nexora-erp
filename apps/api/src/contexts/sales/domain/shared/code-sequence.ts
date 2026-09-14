import { TenantId } from './tenant-id.vo.js';

export const SALES_CODE_SEQUENCE = Symbol('SalesCodeSequence');

export type SalesCodePrefix = 'CLI' | 'PED' | 'DES' | 'FAC';

// Mismo contrato que el del catalogo y el inventario, declarado aqui para no depender de
// ellos: numero siguiente, atomico, por empresa y prefijo.
export interface SalesCodeSequence {
  next(tenantId: TenantId, prefix: SalesCodePrefix): Promise<number>;
}

export function salesCode(prefix: SalesCodePrefix, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}
