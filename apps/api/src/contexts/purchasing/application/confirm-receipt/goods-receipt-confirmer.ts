import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptLineFactory } from '../../domain/receipt/lines/goods-receipt-line-factory.js';
import { ReceiptConfirmation } from '../../domain/receipt/posting/receipt-confirmation.js';
import { ReceiptPosting } from '../../domain/receipt/posting/receipt-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class GoodsReceiptConfirmer {
  constructor(
    private readonly finder: GoodsReceiptFinder,
    private readonly orders: PurchaseOrderFinder,
    private readonly factory: GoodsReceiptLineFactory,
    private readonly receipts: GoodsReceiptRepository,
    private readonly posting: ReceiptPosting,
    private readonly confirmation: ReceiptConfirmation,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; receiptId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const receipt = await this.finder.find(tenantId, GoodsReceiptId.of(request.receiptId));
    const now = this.clock.now();

    // El borrador pudo quedar viejo: el articulo se desactivo o cambio su factor. Se
    // revalida contra la orden y el catalogo de hoy. Lo pendiente se vuelve a comprobar con
    // la orden bloqueada dentro de la publicacion, que es la comprobacion que cuenta.
    if (receipt.currentStatus() === 'draft') {
      const order = await this.orders.find(tenantId, receipt.orderId);

      receipt.update(
        {
          date: receipt.date(),
          notes: receipt.notes(),
          lines: await this.factory.lines(
            tenantId,
            order,
            receipt.lines().map((line) => ({ id: line.id.value, orderLineId: line.orderLineId.value, quantity: line.quantity.toNumber() })),
          ),
        },
        now,
      );
      await this.receipts.save(receipt);
    }

    await this.posting.post(tenantId, receipt.id, (locked, order) => this.confirmation.apply(locked, order, now));
  }
}
