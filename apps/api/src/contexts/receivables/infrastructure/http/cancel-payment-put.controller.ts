import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PaymentCanceller } from '../../application/cancel-payment/payment-canceller.js';

// Anular devuelve el saldo a las facturas: accion propia con su permiso.
@Controller('api/v1/receivables/payments')
export class CancelPaymentPutController {
  constructor(private readonly useCase: PaymentCanceller) {}

  @Put(':paymentId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.payments.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('paymentId') paymentId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, paymentId });
  }
}
