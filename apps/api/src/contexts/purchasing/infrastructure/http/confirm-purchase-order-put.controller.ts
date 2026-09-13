import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseOrderConfirmer } from '../../application/confirm-order/purchase-order-confirmer.js';

// Una accion propia, como confirmar un ajuste: anuncia mercancia en camino y merece su
// ruta, su permiso y su prueba.
@Controller('api/v1/purchasing/orders')
export class ConfirmPurchaseOrderPutController {
  constructor(private readonly confirmer: PurchaseOrderConfirmer) {}

  @Put(':orderId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.orders.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('orderId') orderId: string,
  ): Promise<void> {
    await this.confirmer.run({ tenantId: session.tenantId, orderId });
  }
}
