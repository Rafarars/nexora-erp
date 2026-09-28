import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesReturnSearcher } from '../../application/search-returns/sales-return-searcher.js';
import type { SalesReturnSearcherResponse } from '../../application/search-returns/sales-return-searcher.js';
import { salesReturnQuerySchema } from './dto/sales-return.query.dto.js';
import type { SalesReturnQueryDto } from './dto/sales-return.query.dto.js';

@Controller('api/v1/sales/returns')
export class SearchSalesReturnsGetController {
  constructor(private readonly useCase: SalesReturnSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.returns.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(salesReturnQuerySchema)) query: SalesReturnQueryDto,
  ): Promise<SalesReturnSearcherResponse> {
    return this.useCase.run({ ...query, tenantId: session.tenantId });
  }
}
