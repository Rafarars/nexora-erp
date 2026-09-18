import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { itemQuerySchema } from './dto/item.query.dto.js';
import type { ItemQueryDto } from './dto/item.query.dto.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ItemSearcher } from '../../application/search-items/item-searcher.js';
import type { ItemSearcherResponse } from '../../application/search-items/item-searcher.response.js';

@Controller('api/v1/inventory/items')
export class SearchItemsGetController {
  constructor(private readonly searcher: ItemSearcher) {}

  @Get()
  @RequirePermission('inventory.items.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(itemQuerySchema)) query: ItemQueryDto,
  ): Promise<ItemSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
