import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CustomerSearcher } from '../../application/search-customers/customer-searcher.js';
import type { CustomerResponse } from '../../application/search-customers/customer-searcher.js';

@Controller('api/v1/sales/customers')
export class SearchCustomersGetController {
  constructor(private readonly searcher: CustomerSearcher) {}

  @Get()
  @RequirePermission('sales.customers.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ customers: CustomerResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
