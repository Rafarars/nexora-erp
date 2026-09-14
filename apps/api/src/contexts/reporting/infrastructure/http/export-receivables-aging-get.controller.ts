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

@Controller('api/v1/reports/receivables-aging/export')
export class ExportReceivablesAgingGetController {
  constructor(private readonly exports: ReportExports) {}

  @Get()
  @RequirePermission('reports.receivables.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(exportQuerySchema)) query: ExportQueryDto): Promise<StreamableFile> {
    return reportFile(await this.exports.receivablesAging({ tenantId: session.tenantId }, query.format));
  }
}
