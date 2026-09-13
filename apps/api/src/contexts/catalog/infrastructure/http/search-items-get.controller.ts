import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ItemSearcher } from '../../application/search-items/item-searcher.js';
import type { ItemSearcherResponse } from '../../application/search-items/item-searcher.response.js';

@Controller('api/v1/catalog/items')
export class SearchItemsGetController {
  constructor(private readonly searcher: ItemSearcher) {}

  @Get()
  @RequirePermission('catalog.items.search')
  async run(@Session() session: CurrentSession): Promise<ItemSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
