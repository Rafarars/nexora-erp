import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { GoodsReceiptSearcher } from '../../application/search-receipts/goods-receipt-searcher.js';
import type { GoodsReceiptResponse } from '../../application/search-receipts/goods-receipt-searcher.js';

@Controller('api/v1/purchasing/receipts')
export class SearchGoodsReceiptsGetController {
  constructor(private readonly searcher: GoodsReceiptSearcher) {}

  @Get()
  @RequirePermission('purchasing.receipts.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ receipts: GoodsReceiptResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
