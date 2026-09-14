import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesOrderUpdater } from '../../application/update-order/sales-order-updater.js';
import { salesOrderRequestSchema } from './dto/sales-order.request.dto.js';
import type { SalesOrderRequestDto } from './dto/sales-order.request.dto.js';

@Controller('api/v1/sales/orders')
export class UpdateSalesOrderPutController {
  constructor(private readonly useCase: SalesOrderUpdater) {}

  @Put(':orderId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.orders.update')
  async run(
    @Session() session: CurrentSession,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(salesOrderRequestSchema)) body: SalesOrderRequestDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, orderId, tenantId: session.tenantId });
  }
}
