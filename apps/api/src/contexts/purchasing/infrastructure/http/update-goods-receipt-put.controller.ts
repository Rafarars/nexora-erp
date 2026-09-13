import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { GoodsReceiptUpdater } from '../../application/update-receipt/goods-receipt-updater.js';
import { goodsReceiptUpdateSchema } from './dto/goods-receipt.request.dto.js';
import type { GoodsReceiptUpdateDto } from './dto/goods-receipt.request.dto.js';

@Controller('api/v1/purchasing/receipts')
export class UpdateGoodsReceiptPutController {
  constructor(private readonly updater: GoodsReceiptUpdater) {}

  @Put(':receiptId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.receipts.update')
  async run(
    @Session() session: CurrentSession,
    @Param('receiptId') receiptId: string,
    @Body(new ZodValidationPipe(goodsReceiptUpdateSchema)) body: GoodsReceiptUpdateDto,
  ): Promise<void> {
    await this.updater.run({ ...body, receiptId, tenantId: session.tenantId });
  }
}
