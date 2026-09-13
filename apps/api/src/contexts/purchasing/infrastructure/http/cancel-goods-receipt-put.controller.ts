import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { GoodsReceiptCanceller } from '../../application/cancel-receipt/goods-receipt-canceller.js';

@Controller('api/v1/purchasing/receipts')
export class CancelGoodsReceiptPutController {
  constructor(private readonly canceller: GoodsReceiptCanceller) {}

  @Put(':receiptId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.receipts.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('receiptId') receiptId: string,
  ): Promise<void> {
    await this.canceller.run({ tenantId: session.tenantId, receiptId });
  }
}
