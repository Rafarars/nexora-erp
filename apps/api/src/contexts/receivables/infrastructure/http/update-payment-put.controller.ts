import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PaymentUpdater } from '../../application/update-payment/payment-updater.js';
import { paymentRequestSchema } from './dto/payment.request.dto.js';
import type { PaymentRequestDto } from './dto/payment.request.dto.js';

@Controller('api/v1/receivables/payments')
export class UpdatePaymentPutController {
  constructor(private readonly useCase: PaymentUpdater) {}

  @Put(':paymentId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.payments.update')
  async run(
    @Session() session: CurrentSession,
    @Param('paymentId') paymentId: string,
    @Body(new ZodValidationPipe(paymentRequestSchema)) body: PaymentRequestDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, paymentId, tenantId: session.tenantId });
  }
}
