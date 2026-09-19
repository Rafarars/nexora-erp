import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesOrderSearcher } from '../../application/search-orders/sales-order-searcher.js';
import type { SalesOrderSearcherResponse } from '../../application/search-orders/sales-order-searcher.js';
import { salesOrderQuerySchema } from './dto/sales-order.query.dto.js';
import type { SalesOrderQueryDto } from './dto/sales-order.query.dto.js';

@Controller('api/v1/sales/orders')
export class SearchSalesOrdersGetController {
  constructor(private readonly searcher: SalesOrderSearcher) {}

  @Get()
  @RequirePermission('sales.orders.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(salesOrderQuerySchema)) query: SalesOrderQueryDto,
  ): Promise<SalesOrderSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
