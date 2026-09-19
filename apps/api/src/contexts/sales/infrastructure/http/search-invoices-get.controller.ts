import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { InvoiceSearcher } from '../../application/search-invoices/invoice-searcher.js';
import type { InvoiceSearcherResponse } from '../../application/search-invoices/invoice-searcher.js';
import { invoiceQuerySchema } from './dto/invoice.query.dto.js';
import type { InvoiceQueryDto } from './dto/invoice.query.dto.js';

@Controller('api/v1/sales/invoices')
export class SearchInvoicesGetController {
  constructor(private readonly searcher: InvoiceSearcher) {}

  @Get()
  @RequirePermission('sales.invoices.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(invoiceQuerySchema)) query: InvoiceQueryDto,
  ): Promise<InvoiceSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
