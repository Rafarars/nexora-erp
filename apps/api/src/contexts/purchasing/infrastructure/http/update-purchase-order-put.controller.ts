import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseOrderUpdater } from '../../application/update-order/purchase-order-updater.js';
import { purchaseOrderRequestSchema } from './dto/purchase-order.request.dto.js';
import type { PurchaseOrderRequestDto } from './dto/purchase-order.request.dto.js';

@Controller('api/v1/purchasing/orders')
export class UpdatePurchaseOrderPutController {
  constructor(private readonly updater: PurchaseOrderUpdater) {}

  @Put(':orderId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.orders.update')
  async run(
    @Session() session: CurrentSession,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(purchaseOrderRequestSchema)) body: PurchaseOrderRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, orderId, tenantId: session.tenantId });
  }
}
