import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesOrderCreator } from '../../application/create-order/sales-order-creator.js';
import { salesOrderRequestSchema } from './dto/sales-order.request.dto.js';
import type { SalesOrderRequestDto } from './dto/sales-order.request.dto.js';

@Controller('api/v1/sales/orders')
export class CreateSalesOrderPostController {
  constructor(private readonly useCase: SalesOrderCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales.orders.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(salesOrderRequestSchema)) body: SalesOrderRequestDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, tenantId: session.tenantId });
  }
}
