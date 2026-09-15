import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { CurrencySearcher } from '../../application/search-currencies/currency-searcher.js';
import type { Currency } from '../../domain/currency/currency-catalog.js';

@Controller('api/v1/company')
export class SearchCurrenciesGetController {
  constructor(private readonly searcher: CurrencySearcher) {}

  // Catalogo global, igual para todas las empresas: basta con tener sesion.
  @Get('currencies')
  @AuthenticatedOnly()
  async run(): Promise<{ currencies: Currency[] }> {
    return this.searcher.run();
  }
}
