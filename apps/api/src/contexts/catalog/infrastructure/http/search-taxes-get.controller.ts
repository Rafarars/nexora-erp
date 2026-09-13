import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { TaxSearcher } from '../../application/search-taxes/tax-searcher.js';
import type { TaxSearcherResponse } from '../../application/search-taxes/tax-searcher.js';

@Controller('api/v1/catalog/taxes')
export class SearchTaxesGetController {
  constructor(private readonly searcher: TaxSearcher) {}

  @Get()
  @RequirePermission('catalog.taxes.search')
  async run(@Session() session: CurrentSession): Promise<TaxSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
