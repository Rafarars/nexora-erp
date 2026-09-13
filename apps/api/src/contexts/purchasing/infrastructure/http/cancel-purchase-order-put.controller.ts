import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseOrderCanceller } from '../../application/cancel-order/purchase-order-canceller.js';

@Controller('api/v1/purchasing/orders')
export class CancelPurchaseOrderPutController {
  constructor(private readonly canceller: PurchaseOrderCanceller) {}

  @Put(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.orders.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('orderId') orderId: string,
  ): Promise<void> {
    await this.canceller.run({ tenantId: session.tenantId, orderId });
  }
}
