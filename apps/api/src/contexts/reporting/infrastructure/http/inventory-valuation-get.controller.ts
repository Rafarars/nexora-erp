import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { InventoryValuationReport } from '../../application/inventory-valuation/inventory-valuation-report.js';
import type { InventoryValuationResponse } from '../../application/inventory-valuation/inventory-valuation-report.js';
import { valuationQuerySchema } from './dto/valuation.query.dto.js';
import type { ValuationQueryDto } from './dto/valuation.query.dto.js';

@Controller('api/v1/reports/inventory-valuation')
export class InventoryValuationGetController {
  constructor(private readonly report: InventoryValuationReport) {}

  @Get()
  @RequirePermission('reports.inventory.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(valuationQuerySchema)) query: ValuationQueryDto): Promise<InventoryValuationResponse> {
    return this.report.run({ tenantId: session.tenantId, warehouseId: query.warehouseId });
  }
}
