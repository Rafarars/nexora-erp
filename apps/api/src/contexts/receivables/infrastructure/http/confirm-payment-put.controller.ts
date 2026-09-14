import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PaymentConfirmer } from '../../application/confirm-payment/payment-confirmer.js';

// Confirmar baja el saldo de las facturas: accion propia con su permiso.
@Controller('api/v1/receivables/payments')
export class ConfirmPaymentPutController {
  constructor(private readonly useCase: PaymentConfirmer) {}

  @Put(':paymentId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.payments.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('paymentId') paymentId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, paymentId });
  }
}
