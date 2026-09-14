import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesByCustomerReport } from '../../application/sales-by-customer/sales-by-customer-report.js';
import type { SalesByCustomerResponse } from '../../application/sales-by-customer/sales-by-customer-report.js';
import { periodQuerySchema } from './dto/report.query.dto.js';
import type { PeriodQueryDto } from './dto/report.query.dto.js';

@Controller('api/v1/reports/sales-by-customer')
export class SalesByCustomerGetController {
  constructor(private readonly report: SalesByCustomerReport) {}

  @Get()
  @RequirePermission('reports.sales.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQueryDto): Promise<SalesByCustomerResponse> {
    return this.report.run({ tenantId: session.tenantId, from: query.from, to: query.to });
  }
}
