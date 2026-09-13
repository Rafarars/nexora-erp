import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { GoodsReceipt, GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptLineFactory, GoodsReceiptLineInput } from '../../domain/receipt/lines/goods-receipt-line-factory.js';
import { PurchasingCodeSequence, purchasingCode } from '../../domain/shared/code-sequence.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface GoodsReceiptInput {
  date?: string | null;
  notes?: string | null;
  lines: GoodsReceiptLineInput[];
}

export interface GoodsReceiptCreatorRequest extends GoodsReceiptInput {
  tenantId: string;
  orderId: string;
}

// Un borrador de lo que llego de una orden: todavia no mueve existencia ni la orden.
export class GoodsReceiptCreator {
  constructor(
    private readonly orders: PurchaseOrderFinder,
    private readonly factory: GoodsReceiptLineFactory,
    private readonly receipts: GoodsReceiptRepository,
    private readonly codes: PurchasingCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: GoodsReceiptCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const order = await this.orders.find(tenantId, PurchaseOrderId.of(request.orderId));
    const details = {
      date: request.date ? PurchaseDate.of(request.date) : PurchaseDate.fromDate(now),
      notes: request.notes ?? null,
      lines: await this.factory.lines(tenantId, order, request.lines),
    };
    const id = GoodsReceiptId.of(this.ids.next());
    const target = { id: order.id, warehouseId: order.warehouseId() };

    GoodsReceipt.draft(id, tenantId, purchasingCode('ENT', 0), target, details, now);

    const code = purchasingCode('ENT', await this.codes.next(tenantId, 'ENT'));

    await this.receipts.save(GoodsReceipt.draft(id, tenantId, code, target, details, now));
  }
}
