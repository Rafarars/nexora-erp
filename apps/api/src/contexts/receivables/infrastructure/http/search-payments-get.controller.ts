import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PaymentSearcher } from '../../application/search-payments/payment-searcher.js';
import type { PaymentSearcherResponse } from '../../application/search-payments/payment-searcher.js';
import { paymentQuerySchema } from './dto/payment.query.dto.js';
import type { PaymentQueryDto } from './dto/payment.query.dto.js';

@Controller('api/v1/receivables/payments')
export class SearchPaymentsGetController {
  constructor(private readonly searcher: PaymentSearcher) {}

  @Get()
  @RequirePermission('receivables.payments.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(paymentQuerySchema)) query: PaymentQueryDto,
  ): Promise<PaymentSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
