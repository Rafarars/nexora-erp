import type { TransactionClient } from '../../generated/prisma/internal/prismaNamespace.js';
import type { AccountingEvent } from '../../contexts/accounting/domain/posting/accounting-event.js';

export const DOCUMENT_ACCOUNTING_POSTING = Symbol('DocumentAccountingPosting');

export type { TransactionClient };
export type { AccountingEvent };

/**
 * Puerto de infraestructura transversal para registrar asientos contables
 * dentro de la misma transacción atómica que las operaciones comerciales y de almacén.
 */
export interface DocumentAccountingPosting {
  post(tx: TransactionClient, tenantId: string, event: AccountingEvent): Promise<void>;
}
