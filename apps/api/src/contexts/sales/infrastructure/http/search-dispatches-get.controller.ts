import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DispatchSearcher } from '../../application/search-dispatches/dispatch-searcher.js';
import type { DispatchResponse } from '../../application/search-dispatches/dispatch-searcher.js';

@Controller('api/v1/sales/dispatches')
export class SearchDispatchesGetController {
  constructor(private readonly searcher: DispatchSearcher) {}

  @Get()
  @RequirePermission('sales.dispatches.search')
  async run(
    @Session() session: CurrentSession,
  ): Promise<{ dispatches: DispatchResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
