import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { LowStockSearcher } from '../../application/search-low-stock/low-stock-searcher.js';
import type { LowStockResponse } from '../../application/search-low-stock/low-stock-searcher.js';
import { stockQuerySchema } from './dto/stock.query.dto.js';
import type { StockQueryDto } from './dto/stock.query.dto.js';

// Lo que hay que reponer: mira las mismas existencias, con el mismo permiso.
@Controller('api/v1/inventory/low-stock')
export class SearchLowStockGetController {
  constructor(private readonly searcher: LowStockSearcher) {}

  @Get()
  @RequirePermission('inventory.stock.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(stockQuerySchema)) query: StockQueryDto,
  ): Promise<{ rows: LowStockResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId, warehouseId: query.warehouseId });
  }
}
