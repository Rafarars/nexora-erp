import { Clock } from '../../../../shared/domain/ports/clock.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { ReceiptCancellation } from '../../domain/receipt/posting/receipt-cancellation.js';
import { ReceiptPosting } from '../../domain/receipt/posting/receipt-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Siempre por la publicacion, tambien un borrador: dos anulaciones simultaneas van en fila.
export class GoodsReceiptCanceller {
  constructor(
    private readonly posting: ReceiptPosting,
    private readonly cancellation: ReceiptCancellation,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; receiptId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), GoodsReceiptId.of(request.receiptId), (receipt, order) =>
      this.cancellation.apply(receipt, order, now),
    );
  }
}
