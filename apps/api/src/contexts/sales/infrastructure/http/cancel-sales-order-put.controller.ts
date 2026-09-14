import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SalesOrderCanceller } from '../../application/cancel-order/sales-order-canceller.js';

@Controller('api/v1/sales/orders')
export class CancelSalesOrderPutController {
  constructor(private readonly useCase: SalesOrderCanceller) {}

  @Put(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.orders.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('orderId') orderId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, orderId });
  }
}
