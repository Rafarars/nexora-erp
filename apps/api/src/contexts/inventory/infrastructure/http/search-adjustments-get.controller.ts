import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { AdjustmentSearcher } from '../../application/search-adjustments/adjustment-searcher.js';
import type { AdjustmentSearcherResponse } from '../../application/search-adjustments/adjustment-searcher.js';
import { adjustmentQuerySchema } from './dto/adjustment.query.dto.js';
import type { AdjustmentQueryDto } from './dto/adjustment.query.dto.js';

@Controller('api/v1/inventory/adjustments')
export class SearchAdjustmentsGetController {
  constructor(private readonly searcher: AdjustmentSearcher) {}

  @Get()
  @RequirePermission('inventory.adjustments.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(adjustmentQuerySchema)) query: AdjustmentQueryDto,
  ): Promise<AdjustmentSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
