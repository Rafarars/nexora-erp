import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { DispatchSearcher } from '../../application/search-dispatches/dispatch-searcher.js';
import type { DispatchSearcherResponse } from '../../application/search-dispatches/dispatch-searcher.js';
import { dispatchQuerySchema } from './dto/dispatch.query.dto.js';
import type { DispatchQueryDto } from './dto/dispatch.query.dto.js';

@Controller('api/v1/sales/dispatches')
export class SearchDispatchesGetController {
  constructor(private readonly searcher: DispatchSearcher) {}

  @Get()
  @RequirePermission('sales.dispatches.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(dispatchQuerySchema)) query: DispatchQueryDto,
  ): Promise<DispatchSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
