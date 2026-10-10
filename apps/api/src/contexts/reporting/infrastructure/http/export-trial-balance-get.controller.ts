import { Controller, Get, Query } from '@nestjs/common';
import type { StreamableFile } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ReportExports } from '../../application/documents/report-exports.js';
import { trialBalanceQuerySchema } from './dto/trial-balance.query.dto.js';
import type { TrialBalanceQueryDto } from './dto/trial-balance.query.dto.js';
import { reportFile } from './report-file.js';

@Controller('api/v1/reports/trial-balance/export')
export class ExportTrialBalanceGetController {
  constructor(private readonly exports: ReportExports) {}

  @Get()
  @RequirePermission('accounting.entries.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(trialBalanceQuerySchema)) query: TrialBalanceQueryDto,
  ): Promise<StreamableFile> {
    return reportFile(
      await this.exports.trialBalance(
        { tenantId: session.tenantId, from: query.from, to: query.to },
        query.format,
      ),
    );
  }
}
