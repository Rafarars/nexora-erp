import { Clock } from '../../../../shared/domain/ports/clock.js';
import { GoodsReceiptNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptLineFactory } from '../../domain/receipt/lines/goods-receipt-line-factory.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { GoodsReceiptInput } from '../create-receipt/goods-receipt-creator.js';

export interface GoodsReceiptUpdaterRequest extends GoodsReceiptInput {
  tenantId: string;
  receiptId: string;
}

// Reemplaza fecha, notas y lineas del borrador. La orden y la bodega no cambian: para otra
// orden se hace otra entrada.
export class GoodsReceiptUpdater {
  constructor(
    private readonly finder: GoodsReceiptFinder,
    private readonly orders: PurchaseOrderFinder,
    private readonly factory: GoodsReceiptLineFactory,
    private readonly receipts: GoodsReceiptRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: GoodsReceiptUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const receipt = await this.finder.find(tenantId, GoodsReceiptId.of(request.receiptId));
    const now = this.clock.now();

    // Primero el estado: lo confirmado se rechaza aunque su orden ya no admita entradas.
    if (receipt.currentStatus() !== 'draft') {
      throw new GoodsReceiptNotEditableError(receipt.id.value, receipt.currentStatus());
    }

    const order = await this.orders.find(tenantId, receipt.orderId);

    receipt.update(
      {
        date: request.date ? PurchaseDate.of(request.date) : PurchaseDate.fromDate(now),
        notes: request.notes ?? null,
        lines: await this.factory.lines(tenantId, order, request.lines),
      },
      now,
    );
    await this.receipts.save(receipt);
  }
}
