import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DashboardSearcher } from '../../application/search-dashboard/dashboard-searcher.js';
import type { DashboardResponse } from '../../application/search-dashboard/dashboard-searcher.js';

@Controller('api/v1/reports/dashboard')
export class SearchDashboardGetController {
  constructor(private readonly searcher: DashboardSearcher) {}

  @Get()
  @RequirePermission('reports.dashboard.search')
  async run(@Session() session: CurrentSession): Promise<DashboardResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
