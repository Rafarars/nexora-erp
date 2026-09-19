import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { GoodsReceiptSearcher } from '../../application/search-receipts/goods-receipt-searcher.js';
import type { GoodsReceiptSearcherResponse } from '../../application/search-receipts/goods-receipt-searcher.js';
import { goodsReceiptQuerySchema } from './dto/goods-receipt.query.dto.js';
import type { GoodsReceiptQueryDto } from './dto/goods-receipt.query.dto.js';

@Controller('api/v1/purchasing/receipts')
export class SearchGoodsReceiptsGetController {
  constructor(private readonly searcher: GoodsReceiptSearcher) {}

  @Get()
  @RequirePermission('purchasing.receipts.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(goodsReceiptQuerySchema)) query: GoodsReceiptQueryDto,
  ): Promise<GoodsReceiptSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
