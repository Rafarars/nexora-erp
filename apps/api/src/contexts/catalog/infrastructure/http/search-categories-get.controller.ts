import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CategorySearcher } from '../../application/search-categories/category-searcher.js';
import type { CategorySearcherResponse } from '../../application/search-categories/category-searcher.response.js';

@Controller('api/v1/catalog/categories')
export class SearchCategoriesGetController {
  constructor(private readonly searcher: CategorySearcher) {}

  @Get()
  @RequirePermission('catalog.categories.search')
  async run(@Session() session: CurrentSession): Promise<CategorySearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
