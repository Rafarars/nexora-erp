import { Controller, Get, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CustomerStatementReport } from '../../application/customer-statement/customer-statement-report.js';
import type { CustomerStatementResponse } from '../../application/customer-statement/customer-statement-report.js';

@Controller('api/v1/reports/customers')
export class CustomerStatementGetController {
  constructor(private readonly report: CustomerStatementReport) {}

  @Get(':customerId/statement')
  @RequirePermission('reports.receivables.search')
  async run(@Session() session: CurrentSession, @Param('customerId') customerId: string): Promise<CustomerStatementResponse> {
    return this.report.run({ tenantId: session.tenantId, customerId });
  }
}
