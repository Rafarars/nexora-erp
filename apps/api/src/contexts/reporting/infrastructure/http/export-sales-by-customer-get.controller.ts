import { Controller, Get, Query } from '@nestjs/common';
import type { StreamableFile } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ReportExports } from '../../application/documents/report-exports.js';
import { periodQuerySchema } from './dto/report.query.dto.js';
import type { PeriodQueryDto } from './dto/report.query.dto.js';
import { reportFile } from './report-file.js';

@Controller('api/v1/reports/sales-by-customer/export')
export class ExportSalesByCustomerGetController {
  constructor(private readonly exports: ReportExports) {}

  @Get()
  @RequirePermission('reports.sales.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQueryDto): Promise<StreamableFile> {
    return reportFile(await this.exports.salesByCustomer({ tenantId: session.tenantId, from: query.from, to: query.to }, query.format));
  }
}
