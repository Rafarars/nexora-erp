import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import {
  PurchaseReturnSupplierMismatchError,
  ReceiptNotReturnableError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseReturnLineFactory, PurchaseReturnLineInput } from '../../domain/return/lines/purchase-return-line-factory.js';
import { PurchaseReturn, PurchaseReturnId } from '../../domain/return/purchase-return.entity.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { PurchasingCodeSequence, purchasingCode } from '../../domain/shared/code-sequence.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseReturnInput {
  date?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines: PurchaseReturnLineInput[];
}

export interface PurchaseReturnCreatorRequest extends PurchaseReturnInput {
  tenantId: string;
  supplierId: string;
  receiptId: string;
}

export class PurchaseReturnCreator {
  constructor(
    private readonly suppliers: SupplierFinder,
    private readonly receipts: GoodsReceiptFinder,
    private readonly orders: PurchaseOrderFinder,
    private readonly returns: PurchaseReturnRepository,
    private readonly factory: PurchaseReturnLineFactory,
    private readonly codes: PurchasingCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: PurchaseReturnCreatorRequest): Promise<string> {
    const tenantId = TenantId.of(request.tenantId);
    const supplier = await this.suppliers.find(tenantId, SupplierId.of(request.supplierId));

    const receipt = await this.receipts.find(tenantId, GoodsReceiptId.of(request.receiptId));
    if (receipt.currentStatus() !== 'confirmed') {
      throw new ReceiptNotReturnableError(receipt.id.value, receipt.currentStatus());
    }

    const order = await this.orders.find(tenantId, receipt.orderId);
    if (order.supplierId().value !== supplier.id.value) {
      throw new PurchaseReturnSupplierMismatchError(receipt.id.value, supplier.id.value);
    }

    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const returnDate = request.date ? PurchaseDate.of(request.date) : PurchaseDate.of(today);

    const alreadyReturned = await this.returns.returnedQuantitiesByReceipt(tenantId, receipt.id.value);
    const lines = await this.factory.lines(tenantId, receipt, request.lines, alreadyReturned);

    const sequence = await this.codes.next(tenantId, 'DVC');
    const code = purchasingCode('DVC', sequence);

    const targetReceipt = { id: receipt.id, warehouseId: receipt.warehouseId, date: receipt.date() };
    const details = {
      date: returnDate,
      reason: request.reason ?? null,
      notes: request.notes ?? null,
      lines,
    };

    const returnDoc = PurchaseReturn.draft(
      PurchaseReturnId.of(this.ids.next()),
      tenantId,
      code,
      supplier,
      targetReceipt,
      receipt.currency(),
      details,
      now,
      today,
    );

    await this.returns.save(returnDoc);
    return returnDoc.id.value;
  }
}
