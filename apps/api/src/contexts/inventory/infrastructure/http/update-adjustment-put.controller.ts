import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { AdjustmentUpdater } from '../../application/update-adjustment/adjustment-updater.js';
import { adjustmentRequestSchema } from './dto/adjustment.request.dto.js';
import type { AdjustmentRequestDto } from './dto/adjustment.request.dto.js';

@Controller('api/v1/inventory/adjustments')
export class UpdateAdjustmentPutController {
  constructor(private readonly updater: AdjustmentUpdater) {}

  @Put(':adjustmentId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjustments.update')
  async run(
    @Session() session: CurrentSession,
    @Param('adjustmentId') adjustmentId: string,
    @Body(new ZodValidationPipe(adjustmentRequestSchema)) body: AdjustmentRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, adjustmentId, tenantId: session.tenantId });
  }
}
