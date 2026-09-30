import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import {
  EligiblePurchaseReturnsSearcher,
  EligiblePurchaseReturnDto,
} from '../../application/search-eligible-returns/eligible-purchase-returns-searcher.js';

@Controller('api/v1/payables/invoices')
export class EligiblePurchaseReturnsGetController {
  constructor(private readonly searcher: EligiblePurchaseReturnsSearcher) {}

  @Get(':invoiceId/eligible-returns')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.creditnotes.create')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
  ): Promise<{ returns: EligiblePurchaseReturnDto[] }> {
    const returns = await this.searcher.run({
      tenantId: session.tenantId,
      invoiceId,
    });

    return { returns };
  }
}
