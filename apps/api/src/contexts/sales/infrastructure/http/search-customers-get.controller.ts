import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CustomerSearcher } from '../../application/search-customers/customer-searcher.js';
import type { CustomerSearcherResponse } from '../../application/search-customers/customer-searcher.js';
import { customerQuerySchema } from './dto/customer.query.dto.js';
import type { CustomerQueryDto } from './dto/customer.query.dto.js';

@Controller('api/v1/sales/customers')
export class SearchCustomersGetController {
  constructor(private readonly searcher: CustomerSearcher) {}

  @Get()
  @RequirePermission('sales.customers.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(customerQuerySchema)) query: CustomerQueryDto,
  ): Promise<CustomerSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
