import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { WarehouseSearcher } from '../../application/search-warehouses/warehouse-searcher.js';
import type { WarehouseSearcherResponse } from '../../application/search-warehouses/warehouse-searcher.js';

@Controller('api/v1/catalog/warehouses')
export class SearchWarehousesGetController {
  constructor(private readonly searcher: WarehouseSearcher) {}

  @Get()
  @RequirePermission('catalog.warehouses.search')
  async run(@Session() session: CurrentSession): Promise<WarehouseSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
