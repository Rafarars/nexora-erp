import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { GoodsReceiptCreator } from '../../application/create-receipt/goods-receipt-creator.js';
import { goodsReceiptCreateSchema } from './dto/goods-receipt.request.dto.js';
import type { GoodsReceiptCreateDto } from './dto/goods-receipt.request.dto.js';

@Controller('api/v1/purchasing/receipts')
export class CreateGoodsReceiptPostController {
  constructor(private readonly creator: GoodsReceiptCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing.receipts.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(goodsReceiptCreateSchema)) body: GoodsReceiptCreateDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
