import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ReceivablesAgingReport } from '../../application/receivables-aging/receivables-aging-report.js';
import type { ReceivablesAgingResponse } from '../../application/receivables-aging/receivables-aging-report.js';

@Controller('api/v1/reports/receivables-aging')
export class ReceivablesAgingGetController {
  constructor(private readonly report: ReceivablesAgingReport) {}

  @Get()
  @RequirePermission('reports.receivables.search')
  async run(@Session() session: CurrentSession): Promise<ReceivablesAgingResponse> {
    return this.report.run({ tenantId: session.tenantId });
  }
}
