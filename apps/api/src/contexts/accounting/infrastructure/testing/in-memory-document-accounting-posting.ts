import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import type {
  AccountingEvent,
  DocumentAccountingPosting,
} from '../../../../shared/prisma/document-accounting-posting.js';

export class InMemoryDocumentAccountingPosting implements DocumentAccountingPosting {
  readonly postedEvents: { tenantId: string; event: AccountingEvent }[] = [];

  async post(_tx: TransactionClient, tenantId: string, event: AccountingEvent): Promise<void> {
    this.postedEvents.push({ tenantId, event });
  }

  clear(): void {
    this.postedEvents.length = 0;
  }
}
