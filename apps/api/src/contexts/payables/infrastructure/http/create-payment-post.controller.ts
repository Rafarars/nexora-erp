import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PaymentCreator } from '../../application/create-payment/payment-creator.js';
import { paymentRequestSchema } from './dto/payment.request.dto.js';
import type { PaymentRequestDto } from './dto/payment.request.dto.js';

@Controller('api/v1/payables/payments')
export class CreatePaymentPostController {
  constructor(private readonly useCase: PaymentCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('payables.payments.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(paymentRequestSchema)) body: PaymentRequestDto,
  ): Promise<{ id: string; code: string }> {
    return this.useCase.run({ ...body, tenantId: session.tenantId });
  }
}
