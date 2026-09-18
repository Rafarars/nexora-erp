import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PriceListSearcher } from '../../application/search-price-lists/price-list-searcher.js';
import type { PriceListSearcherResponse } from '../../application/search-price-lists/price-list-searcher.js';

@Controller('api/v1/catalog/price-lists')
export class SearchPriceListsGetController {
  constructor(private readonly searcher: PriceListSearcher) {}

  @Get()
  @RequirePermission('catalog.pricelists.search')
  async run(@Session() session: CurrentSession): Promise<PriceListSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
