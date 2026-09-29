import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierBalanceSearcher } from '../../application/search-supplier-balances/supplier-balance-searcher.js';
import { supplierBalanceQuerySchema } from './dto/supplier-balance.query.dto.js';
import type { SupplierBalanceQueryDto } from './dto/supplier-balance.query.dto.js';

@Controller('api/v1/payables/suppliers')
export class SearchSupplierBalancesGetController {
  constructor(private readonly searcher: SupplierBalanceSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.balances.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(supplierBalanceQuerySchema)) query: SupplierBalanceQueryDto,
  ) {
    return this.searcher.run({
      tenantId: session.tenantId,
      q: query.q,
      onlyWithBalance: query.onlyWithBalance,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
