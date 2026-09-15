import { TenantId } from './tenant-id.vo.js';

export const INVENTORY_CODE_SEQUENCE = Symbol('InventoryCodeSequence');

export type InventoryCodePrefix = 'AJU' | 'ART';

// Mismo contrato que el del catalogo, declarado aqui para no depender de el: numero
// siguiente, atomico, por empresa y prefijo.
export interface InventoryCodeSequence {
  next(tenantId: TenantId, prefix: InventoryCodePrefix): Promise<number>;
}

export function documentCode(prefix: InventoryCodePrefix, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}
