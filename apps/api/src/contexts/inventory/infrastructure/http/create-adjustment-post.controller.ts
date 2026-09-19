import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { AdjustmentCreator } from '../../application/create-adjustment/adjustment-creator.js';
import { adjustmentRequestSchema } from './dto/adjustment.request.dto.js';
import type { AdjustmentRequestDto } from './dto/adjustment.request.dto.js';

@Controller('api/v1/inventory/adjustments')
export class CreateAdjustmentPostController {
  constructor(private readonly creator: AdjustmentCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('inventory.adjustments.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(adjustmentRequestSchema)) body: AdjustmentRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId, userId: session.userId });
  }
}
