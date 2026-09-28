import { TenantId } from './tenant-id.vo.js';

export const PAYABLES_CODE_SEQUENCE = Symbol('PayablesCodeSequence');

export type PayablesCodePrefix = 'PAG' | 'NCP';

// Mismo contrato que los demas contextos: numero siguiente, atomico, por empresa y prefijo.
export interface PayablesCodeSequence {
  next(tenantId: TenantId, prefix: PayablesCodePrefix): Promise<number>;
}

export function payablesCode(prefix: PayablesCodePrefix, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}
