import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PayableInvoiceSearcher } from '../../application/search-invoices/payable-invoice-searcher.js';
import { payableInvoiceQuerySchema } from './dto/payable-invoice.query.dto.js';
import type { PayableInvoiceQueryDto } from './dto/payable-invoice.query.dto.js';

@Controller('api/v1/payables/invoices')
export class SearchPayableInvoicesGetController {
  constructor(private readonly searcher: PayableInvoiceSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.balances.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(payableInvoiceQuerySchema)) query: PayableInvoiceQueryDto,
  ) {
    return this.searcher.run({
      tenantId: session.tenantId,
      q: query.q,
      supplierId: query.supplierId,
      status: query.status,
      from: query.from,
      to: query.to,
      onlyOverdue: query.onlyOverdue,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
