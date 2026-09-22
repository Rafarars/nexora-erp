import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ReceiptLineQuotaResponse {
  receiptLineId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  receivedQuantity: number;
  alreadyReturnedQuantity: number;
  availableToReturnQuantity: number;
  unitCost: number;
}

export interface ReceiptReturnQuotaResponse {
  receiptId: string;
  lines: ReceiptLineQuotaResponse[];
}

export class ReceiptReturnQuotaFinder {
  constructor(
    private readonly receipts: GoodsReceiptFinder,
    private readonly returns: PurchaseReturnRepository,
  ) {}

  async run(tenantIdStr: string, receiptIdStr: string): Promise<ReceiptReturnQuotaResponse> {
    const tenantId = TenantId.of(tenantIdStr);
    const receipt = await this.receipts.find(tenantId, GoodsReceiptId.of(receiptIdStr));

    const alreadyReturned = await this.returns.returnedQuantitiesByReceipt(tenantId, receipt.id.value);

    const lines: ReceiptLineQuotaResponse[] = receipt.lines().map((line) => {
      const received = line.quantity.toNumber();
      const returned = alreadyReturned.get(line.id.value) ?? 0;
      const available = Math.max(0, received - returned);

      return {
        receiptLineId: line.id.value,
        itemId: line.itemId.value,
        itemSku: line.itemSku,
        itemName: line.itemName,
        unitId: line.unitId.value,
        receivedQuantity: received,
        alreadyReturnedQuantity: returned,
        availableToReturnQuantity: available,
        unitCost: line.unitCost.toNumber(),
      };
    });

    return {
      receiptId: receipt.id.value,
      lines,
    };
  }
}
