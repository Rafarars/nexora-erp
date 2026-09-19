import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CustomerBalanceSearcher } from '../../application/search-customer-balances/customer-balance-searcher.js';
import type { CustomerBalanceSearcherResponse } from '../../application/search-customer-balances/customer-balance-searcher.js';
import { customerBalanceQuerySchema } from './dto/customer-balance.query.dto.js';
import type { CustomerBalanceQueryDto } from './dto/customer-balance.query.dto.js';

@Controller('api/v1/receivables/customers')
export class SearchCustomerBalancesGetController {
  constructor(private readonly searcher: CustomerBalanceSearcher) {}

  @Get()
  @RequirePermission('receivables.balances.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(customerBalanceQuerySchema)) query: CustomerBalanceQueryDto,
  ): Promise<CustomerBalanceSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
