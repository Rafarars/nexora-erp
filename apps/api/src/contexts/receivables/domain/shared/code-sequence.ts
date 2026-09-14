import { TenantId } from './tenant-id.vo.js';

export const RECEIVABLES_CODE_SEQUENCE = Symbol('ReceivablesCodeSequence');

export type ReceivablesCodePrefix = 'COB';

// Mismo contrato que el de los demas contextos, declarado aqui para no depender de ellos.
export interface ReceivablesCodeSequence {
  next(tenantId: TenantId, prefix: ReceivablesCodePrefix): Promise<number>;
}

export function receivablesCode(prefix: ReceivablesCodePrefix, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}
