import { Controller, Get, Param, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { MovementSearcher } from '../../application/search-movements/movement-searcher.js';
import type { MovementResponse } from '../../application/search-movements/movement-searcher.js';
import { stockQuerySchema } from './dto/stock.query.dto.js';
import type { StockQueryDto } from './dto/stock.query.dto.js';

@Controller('api/v1/inventory/items')
export class SearchMovementsGetController {
  constructor(private readonly searcher: MovementSearcher) {}

  @Get(':itemId/movements')
  @RequirePermission('inventory.movements.search')
  async run(
    @Session() session: CurrentSession,
    @Param('itemId') itemId: string,
    @Query(new ZodValidationPipe(stockQuerySchema)) query: StockQueryDto,
  ): Promise<{ movements: MovementResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId, itemId, warehouseId: query.warehouseId });
  }
}
