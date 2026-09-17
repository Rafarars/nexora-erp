import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { PurchaseOrder, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { GoodsReceipt, GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptLineFactory, GoodsReceiptLineInput } from '../../domain/receipt/lines/goods-receipt-line-factory.js';
import { PurchasingCodeSequence, purchasingCode } from '../../domain/shared/code-sequence.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface GoodsReceiptInput {
  date?: string | null;
  notes?: string | null;
  // Vacia, la tasa del dia en que llego.
  exchangeRate?: number | null;
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
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: GoodsReceiptCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const order = await this.orders.find(tenantId, PurchaseOrderId.of(request.orderId));
    const date = request.date ? PurchaseDate.of(request.date) : PurchaseDate.of(today);
    const lines = await this.factory.lines(tenantId, order, request.lines);
    const details = { date, notes: request.notes ?? null, lines, currency: await receiptCurrency(this.rates, request.tenantId, order, date, request.exchangeRate, today) };
    const id = GoodsReceiptId.of(this.ids.next());
    const target = { id: order.id, warehouseId: order.warehouseId() };

    GoodsReceipt.draft(id, tenantId, purchasingCode('ENT', 0), target, details, now, today);

    const code = purchasingCode('ENT', await this.codes.next(tenantId, 'ENT'));

    await this.receipts.save(GoodsReceipt.draft(id, tenantId, code, target, details, now, today));
  }
}

// La moneda de la entrada es la de su orden, con las tasas del dia en que llego o la escrita a mano.
// Con la fecha ya validada: una entrada futura no pregunta por tasas.
export async function receiptCurrency(
  rates: DocumentRates,
  tenantId: string,
  order: PurchaseOrder,
  date: PurchaseDate,
  manualRate: number | null | undefined,
  today: string,
): Promise<DocumentCurrency> {
  date.ensureNotAfter(today);

  return DocumentCurrency.of(await rates.forDocument(tenantId, { currency: order.currency().currency, date: date.value, manualRate, keepsCurrency: true }));
}
