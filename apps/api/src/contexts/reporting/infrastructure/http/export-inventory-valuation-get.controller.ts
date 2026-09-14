import { Controller, Get, Query } from '@nestjs/common';
import type { StreamableFile } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ReportExports } from '../../application/documents/report-exports.js';
import { valuationQuerySchema } from './dto/valuation.query.dto.js';
import type { ValuationQueryDto } from './dto/valuation.query.dto.js';
import { reportFile } from './report-file.js';

@Controller('api/v1/reports/inventory-valuation/export')
export class ExportInventoryValuationGetController {
  constructor(private readonly exports: ReportExports) {}

  @Get()
  @RequirePermission('reports.inventory.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(valuationQuerySchema)) query: ValuationQueryDto): Promise<StreamableFile> {
    return reportFile(await this.exports.inventoryValuation({ tenantId: session.tenantId, warehouseId: query.warehouseId }, query.format));
  }
}
