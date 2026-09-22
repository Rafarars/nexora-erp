import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { PurchasingCatalog } from '../../catalog/purchasing-catalog.js';
import {
  InactivePurchaseWarehouseError,
  InvalidPurchaseQuantityError,
  PurchaseWarehouseNotFoundError,
  QuantityExceedsReceiptReturnQuotaError,
  ReceiptLineNotFoundError,
} from '../../errors/purchasing.errors.js';
import { GoodsReceipt } from '../../receipt/goods-receipt.entity.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseReturnLine, PurchaseReturnLineId } from '../purchase-return-line.js';

export interface PurchaseReturnLineInput {
  id?: string;
  receiptLineId: string;
  quantity: number;
}

export class PurchaseReturnLineFactory {
  constructor(
    private readonly catalog: PurchasingCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async lines(
    tenantId: TenantId,
    receipt: GoodsReceipt,
    inputs: PurchaseReturnLineInput[],
    alreadyReturned: Map<string, number>,
  ): Promise<PurchaseReturnLine[]> {
    const [warehouse] = await this.catalog.findWarehouses(tenantId, [receipt.warehouseId]);
    if (!warehouse) throw new PurchaseWarehouseNotFoundError(receipt.warehouseId.value);
    if (!warehouse.isActive) throw new InactivePurchaseWarehouseError(warehouse.id);

    const receiptLines = receipt.lines();

    return inputs.map((input, index) => {
      const receiptLine = receiptLines.find((candidate) => candidate.id.value === input.receiptLineId);
      if (!receiptLine) throw new ReceiptLineNotFoundError(input.receiptLineId);

      const returned = alreadyReturned.get(receiptLine.id.value) ?? 0;
      const available = Math.max(0, receiptLine.quantity.toNumber() - returned);

      const quantity = Quantity.of(input.quantity);
      if (quantity.isZero() || input.quantity <= 0) throw new InvalidPurchaseQuantityError(input.quantity);

      if (input.quantity > available + 1e-6) {
        throw new QuantityExceedsReceiptReturnQuotaError(receiptLine.id.value, available, input.quantity);
      }

      // Proporcional a la unidad base recibida
      const factor = receiptLine.baseQuantity.toNumber() / receiptLine.quantity.toNumber();
      const baseQuantity = Quantity.of(Math.round(input.quantity * factor * 10000) / 10000);

      return PurchaseReturnLine.of({
        id: input.id ? PurchaseReturnLineId.of(input.id) : PurchaseReturnLineId.of(this.ids.next()),
        lineNumber: index + 1,
        receiptLineId: receiptLine.id.value,
        itemId: receiptLine.itemId,
        itemSku: receiptLine.itemSku,
        itemName: receiptLine.itemName,
        unitId: receiptLine.unitId,
        quantity,
        baseQuantity,
        unitCost: receiptLine.unitCost,
      });
    });
  }
}
