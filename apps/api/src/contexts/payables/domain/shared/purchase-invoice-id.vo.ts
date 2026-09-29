import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class PurchaseInvoiceId extends Uuid {
  static of(value: string): PurchaseInvoiceId {
    return new PurchaseInvoiceId(value);
  }
}
