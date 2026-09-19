import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierSearcher } from '../../application/search-suppliers/supplier-searcher.js';
import type { SupplierSearcherResponse } from '../../application/search-suppliers/supplier-searcher.js';
import { supplierQuerySchema } from './dto/supplier.query.dto.js';
import type { SupplierQueryDto } from './dto/supplier.query.dto.js';

@Controller('api/v1/purchasing/suppliers')
export class SearchSuppliersGetController {
  constructor(private readonly searcher: SupplierSearcher) {}

  @Get()
  @RequirePermission('purchasing.suppliers.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(supplierQuerySchema)) query: SupplierQueryDto,
  ): Promise<SupplierSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
