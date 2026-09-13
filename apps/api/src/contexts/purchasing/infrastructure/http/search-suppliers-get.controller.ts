import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SupplierSearcher } from '../../application/search-suppliers/supplier-searcher.js';
import type { SupplierResponse } from '../../application/search-suppliers/supplier-searcher.js';

@Controller('api/v1/purchasing/suppliers')
export class SearchSuppliersGetController {
  constructor(private readonly searcher: SupplierSearcher) {}

  @Get()
  @RequirePermission('purchasing.suppliers.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ suppliers: SupplierResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
