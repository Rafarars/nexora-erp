import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PaymentSearcher } from '../../application/search-payments/payment-searcher.js';
import type { PaymentResponse } from '../../application/search-payments/payment-searcher.js';

@Controller('api/v1/receivables/payments')
export class SearchPaymentsGetController {
  constructor(private readonly searcher: PaymentSearcher) {}

  @Get()
  @RequirePermission('receivables.payments.search')
  async run(@Session() session: CurrentSession): Promise<{ payments: PaymentResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
