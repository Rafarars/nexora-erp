import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { StockSearcher } from '../../application/search-stock/stock-searcher.js';
import type { StockResponse } from '../../application/search-stock/stock-searcher.js';
import { stockQuerySchema } from './dto/stock.query.dto.js';
import type { StockQueryDto } from './dto/stock.query.dto.js';

// La bodega llega como filtro. Una de otra empresa responde 404, como en todo el sistema.
@Controller('api/v1/inventory/stock')
export class SearchStockGetController {
  constructor(private readonly searcher: StockSearcher) {}

  @Get()
  @RequirePermission('inventory.stock.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(stockQuerySchema)) query: StockQueryDto,
  ): Promise<{ stocks: StockResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId, warehouseId: query.warehouseId });
  }
}
