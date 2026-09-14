import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CustomerBalanceSearcher } from '../../application/search-customer-balances/customer-balance-searcher.js';
import type { CustomerBalanceResponse } from '../../application/search-customer-balances/customer-balance-searcher.js';
import type { AgingTotals } from '../../domain/aging/aging.js';

@Controller('api/v1/receivables/customers')
export class SearchCustomerBalancesGetController {
  constructor(private readonly searcher: CustomerBalanceSearcher) {}

  @Get()
  @RequirePermission('receivables.balances.search')
  async run(@Session() session: CurrentSession): Promise<{ customers: CustomerBalanceResponse[]; totals: AgingTotals }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
