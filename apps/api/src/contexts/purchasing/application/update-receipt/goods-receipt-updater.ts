import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { GoodsReceiptNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptLineFactory } from '../../domain/receipt/lines/goods-receipt-line-factory.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { GoodsReceiptInput, receiptCurrency } from '../create-receipt/goods-receipt-creator.js';

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
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: GoodsReceiptUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const receipt = await this.finder.find(tenantId, GoodsReceiptId.of(request.receiptId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Primero el estado: lo confirmado se rechaza aunque su orden ya no admita entradas.
    if (receipt.currentStatus() !== 'draft') {
      throw new GoodsReceiptNotEditableError(receipt.id.value, receipt.currentStatus());
    }

    const order = await this.orders.find(tenantId, receipt.orderId);

    const date = request.date ? PurchaseDate.of(request.date) : PurchaseDate.of(today);
    const lines = await this.factory.lines(tenantId, order, request.lines);

    receipt.update(
      { date, notes: request.notes ?? null, lines, currency: await receiptCurrency(this.rates, request.tenantId, order, date, request.exchangeRate, today) },
      now,
      today,
    );
    await this.receipts.save(receipt);
  }
}
