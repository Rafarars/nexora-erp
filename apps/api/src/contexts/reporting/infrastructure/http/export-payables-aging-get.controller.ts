import { Controller, Get, Query } from '@nestjs/common';
import type { StreamableFile } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ReportExports } from '../../application/documents/report-exports.js';
import { exportQuerySchema } from './dto/report.query.dto.js';
import type { ExportQueryDto } from './dto/report.query.dto.js';
import { reportFile } from './report-file.js';

@Controller('api/v1/reports/payables-aging/export')
export class ExportPayablesAgingGetController {
  constructor(private readonly exports: ReportExports) {}

  @Get()
  @RequirePermission('payables.balances.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(exportQuerySchema)) query: ExportQueryDto): Promise<StreamableFile> {
    return reportFile(await this.exports.payablesAging({ tenantId: session.tenantId }, query.format));
  }
}
