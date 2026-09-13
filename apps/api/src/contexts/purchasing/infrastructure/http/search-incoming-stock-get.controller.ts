import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { IncomingStockSearcher } from '../../application/search-incoming/incoming-stock-searcher.js';
import type { IncomingStockResponse } from '../../application/search-incoming/incoming-stock-searcher.js';
import { incomingQuerySchema } from './dto/goods-receipt.request.dto.js';
import type { IncomingQueryDto } from './dto/goods-receipt.request.dto.js';

@Controller('api/v1/purchasing/incoming')
export class SearchIncomingStockGetController {
  constructor(private readonly searcher: IncomingStockSearcher) {}

  @Get()
  @RequirePermission('purchasing.incoming.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(incomingQuerySchema)) query: IncomingQueryDto,
  ): Promise<{ incoming: IncomingStockResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId, warehouseId: query.warehouseId });
  }
}
