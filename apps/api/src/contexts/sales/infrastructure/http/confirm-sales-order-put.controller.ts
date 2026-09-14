import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SalesOrderConfirmer } from '../../application/confirm-order/sales-order-confirmer.js';

// Confirmar reserva existencia: accion propia con su permiso.
@Controller('api/v1/sales/orders')
export class ConfirmSalesOrderPutController {
  constructor(private readonly useCase: SalesOrderConfirmer) {}

  @Put(':orderId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.orders.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('orderId') orderId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, orderId });
  }
}
