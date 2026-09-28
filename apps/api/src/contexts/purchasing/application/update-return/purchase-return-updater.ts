import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { PurchaseReturnFinder } from '../../domain/return/find/purchase-return-finder.js';
import { PurchaseReturnLineFactory, PurchaseReturnLineInput } from '../../domain/return/lines/purchase-return-line-factory.js';
import { PurchaseReturnId } from '../../domain/return/purchase-return.entity.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseReturnUpdaterRequest {
  tenantId: string;
  returnId: string;
  date?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines: PurchaseReturnLineInput[];
}

export class PurchaseReturnUpdater {
  constructor(
    private readonly finder: PurchaseReturnFinder,
    private readonly receipts: GoodsReceiptFinder,
    private readonly returns: PurchaseReturnRepository,
    private readonly factory: PurchaseReturnLineFactory,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: PurchaseReturnUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const returnDoc = await this.finder.find(tenantId, PurchaseReturnId.of(request.returnId));

    const receipt = await this.receipts.find(tenantId, returnDoc.receiptId);

    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const returnDate = request.date ? PurchaseDate.of(request.date) : PurchaseDate.of(today);

    const alreadyReturned = await this.returns.returnedQuantitiesByReceipt(
      tenantId,
      receipt.id.value,
      returnDoc.id.value,
    );
    const lines = await this.factory.lines(tenantId, receipt, request.lines, alreadyReturned);

    returnDoc.rewrite(
      {
        date: returnDate,
        reason: request.reason ?? null,
        notes: request.notes ?? null,
        lines,
      },
      receipt.date(),
      now,
      today,
    );

    await this.returns.save(returnDoc);
  }
}
