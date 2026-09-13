import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { AdjustmentCanceller } from '../../application/cancel-adjustment/adjustment-canceller.js';

@Controller('api/v1/inventory/adjustments')
export class CancelAdjustmentPutController {
  constructor(private readonly canceller: AdjustmentCanceller) {}

  @Put(':adjustmentId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjustments.cancel')
  async run(@Session() session: CurrentSession, @Param('adjustmentId') adjustmentId: string): Promise<void> {
    await this.canceller.run({ tenantId: session.tenantId, adjustmentId });
  }
}
