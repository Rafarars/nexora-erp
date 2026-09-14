import { Controller, Get, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CustomerStatementSearcher } from '../../application/search-customer-statement/customer-statement-searcher.js';
import type { StatementMovement } from '../../application/search-customer-statement/customer-statement-searcher.js';
import type { CustomerBalanceResponse } from '../../application/search-customer-balances/customer-balance-searcher.js';

@Controller('api/v1/receivables/customers')
export class SearchCustomerStatementGetController {
  constructor(private readonly searcher: CustomerStatementSearcher) {}

  @Get(':customerId/statement')
  @RequirePermission('receivables.statements.search')
  async run(
    @Session() session: CurrentSession,
    @Param('customerId') customerId: string,
  ): Promise<{ summary: CustomerBalanceResponse; movements: StatementMovement[] }> {
    return this.searcher.run({ tenantId: session.tenantId, customerId });
  }
}
