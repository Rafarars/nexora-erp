import { Clock } from '../../../../shared/domain/ports/clock.js';
import { GoodsReceiptHasConfirmedInvoicesError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseInvoiceRepository } from '../../domain/invoice/purchase-invoice.repository.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { ReceiptCancellation } from '../../domain/receipt/posting/receipt-cancellation.js';
import { ReceiptPosting } from '../../domain/receipt/posting/receipt-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Siempre por la publicacion, tambien un borrador: dos anulaciones simultaneas van en fila.
export class GoodsReceiptCanceller {
  constructor(
    private readonly posting: ReceiptPosting,
    private readonly cancellation: ReceiptCancellation,
    private readonly invoices: PurchaseInvoiceRepository,
    private readonly receipts: GoodsReceiptRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; receiptId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const receiptId = GoodsReceiptId.of(request.receiptId);

    const receipt = await this.receipts.find(tenantId, receiptId);
    if (receipt && receipt.currentStatus() === 'confirmed') {
      const lineIds = receipt.lines().map((l) => l.id.value);
      const invoicedMap = await this.invoices.invoicedQuantitiesByReceiptLine(tenantId, lineIds);
      const totalInvoiced = Array.from(invoicedMap.values()).reduce((sum, qty) => sum + qty, 0);
      if (totalInvoiced > 0) {
        throw new GoodsReceiptHasConfirmedInvoicesError(receiptId.value);
      }
    }

    const now = this.clock.now();

    await this.posting.post(tenantId, receiptId, (r, order) =>
      this.cancellation.apply(r, order, now),
    );
  }
}
