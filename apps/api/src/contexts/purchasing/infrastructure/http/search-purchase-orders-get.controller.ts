import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseOrderSearcher } from '../../application/search-orders/purchase-order-searcher.js';
import type { PurchaseOrderSearcherResponse } from '../../application/search-orders/purchase-order-searcher.js';
import { purchaseOrderQuerySchema } from './dto/purchase-order.query.dto.js';
import type { PurchaseOrderQueryDto } from './dto/purchase-order.query.dto.js';

@Controller('api/v1/purchasing/orders')
export class SearchPurchaseOrdersGetController {
  constructor(private readonly searcher: PurchaseOrderSearcher) {}

  @Get()
  @RequirePermission('purchasing.orders.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(purchaseOrderQuerySchema)) query: PurchaseOrderQueryDto,
  ): Promise<PurchaseOrderSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
