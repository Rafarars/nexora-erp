import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TrialBalanceReport } from '../../application/trial-balance/trial-balance-report.js';
import type { TrialBalanceResponse } from '../../application/trial-balance/trial-balance-report.js';
import { pagedTrialBalanceQuerySchema } from './dto/trial-balance.query.dto.js';
import type { PagedTrialBalanceQueryDto } from './dto/trial-balance.query.dto.js';

const DEFAULT_PAGE = 50;

@Controller('api/v1/reports/trial-balance')
export class TrialBalanceGetController {
  constructor(private readonly report: TrialBalanceReport) {}

  @Get()
  @RequirePermission('accounting.entries.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(pagedTrialBalanceQuerySchema)) query: PagedTrialBalanceQueryDto,
  ): Promise<TrialBalanceResponse> {
    return this.report.run({
      tenantId: session.tenantId,
      from: query.from,
      to: query.to,
      limit: query.limit ?? DEFAULT_PAGE,
      offset: query.offset,
    });
  }
}
