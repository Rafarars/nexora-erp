import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { AdjustmentSearcher } from '../../application/search-adjustments/adjustment-searcher.js';
import type { AdjustmentResponse } from '../../application/search-adjustments/adjustment-searcher.js';

@Controller('api/v1/inventory/adjustments')
export class SearchAdjustmentsGetController {
  constructor(private readonly searcher: AdjustmentSearcher) {}

  @Get()
  @RequirePermission('inventory.adjustments.search')
  async run(@Session() session: CurrentSession): Promise<{ adjustments: AdjustmentResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
