import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ExchangeRateSearcher } from '../../application/search-exchange-rates/exchange-rate-searcher.js';
import type { ExchangeRateSearcherResponse } from '../../application/search-exchange-rates/exchange-rate-searcher.js';
import { exchangeRateQuerySchema } from './dto/company.request.dto.js';
import type { ExchangeRateQueryDto } from './dto/company.request.dto.js';

@Controller('api/v1/company')
export class SearchExchangeRatesGetController {
  constructor(private readonly searcher: ExchangeRateSearcher) {}

  @Get('exchange-rates')
  @RequirePermission('company.rates.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(exchangeRateQuerySchema)) query: ExchangeRateQueryDto,
  ): Promise<ExchangeRateSearcherResponse> {
    return this.searcher.run({ ...query, tenantId: session.tenantId });
  }
}
