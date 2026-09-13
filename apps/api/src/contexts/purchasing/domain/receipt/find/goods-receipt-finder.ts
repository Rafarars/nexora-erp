import { GoodsReceiptNotFoundError } from '../../errors/purchasing.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { GoodsReceipt, GoodsReceiptId } from '../goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../goods-receipt.repository.js';

export class GoodsReceiptFinder {
  constructor(private readonly receipts: GoodsReceiptRepository) {}

  async find(tenantId: TenantId, id: GoodsReceiptId): Promise<GoodsReceipt> {
    const receipt = await this.receipts.find(tenantId, id);

    if (!receipt) throw new GoodsReceiptNotFoundError(id.value);

    return receipt;
  }
}
