import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseOrderCreator } from '../../application/create-order/purchase-order-creator.js';
import { purchaseOrderRequestSchema } from './dto/purchase-order.request.dto.js';
import type { PurchaseOrderRequestDto } from './dto/purchase-order.request.dto.js';

@Controller('api/v1/purchasing/orders')
export class CreatePurchaseOrderPostController {
  constructor(private readonly creator: PurchaseOrderCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing.orders.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(purchaseOrderRequestSchema)) body: PurchaseOrderRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
