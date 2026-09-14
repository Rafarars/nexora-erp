import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SalesOrderSearcher } from '../../application/search-orders/sales-order-searcher.js';
import type { SalesOrderResponse } from '../../application/search-orders/sales-order-searcher.js';

@Controller('api/v1/sales/orders')
export class SearchSalesOrdersGetController {
  constructor(private readonly searcher: SalesOrderSearcher) {}

  @Get()
  @RequirePermission('sales.orders.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ orders: SalesOrderResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
