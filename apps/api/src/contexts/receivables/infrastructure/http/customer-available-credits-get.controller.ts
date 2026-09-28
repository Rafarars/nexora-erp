import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CustomerAvailableCreditsFinder } from '../../application/customer-available-credits/customer-available-credits-finder.js';

@Controller('api/v1/receivables/customers')
export class CustomerAvailableCreditsGetController {
  constructor(private readonly useCase: CustomerAvailableCreditsFinder) {}

  @Get(':customerId/available-credits')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.payments.create')
  async run(
    @Session() session: CurrentSession,
    @Param('customerId') customerId: string,
  ): Promise<{ credits: unknown[] }> {
    const result = await this.useCase.run({ customerId, tenantId: session.tenantId });

    return { credits: result.notes };
  }
}
