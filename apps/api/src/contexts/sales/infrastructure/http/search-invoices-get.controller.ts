import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { InvoiceSearcher } from '../../application/search-invoices/invoice-searcher.js';
import type { InvoiceResponse } from '../../application/search-invoices/invoice-searcher.js';

@Controller('api/v1/sales/invoices')
export class SearchInvoicesGetController {
  constructor(private readonly searcher: InvoiceSearcher) {}

  @Get()
  @RequirePermission('sales.invoices.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ invoices: InvoiceResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
