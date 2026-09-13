import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseOrderSearcher } from '../../application/search-orders/purchase-order-searcher.js';
import type { PurchaseOrderResponse } from '../../application/search-orders/purchase-order-searcher.js';

@Controller('api/v1/purchasing/orders')
export class SearchPurchaseOrdersGetController {
  constructor(private readonly searcher: PurchaseOrderSearcher) {}

  @Get()
  @RequirePermission('purchasing.orders.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ orders: PurchaseOrderResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
