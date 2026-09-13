import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ItemStatusChanger } from '../../application/change-item-status/item-status-changer.js';
import { statusRequestSchema } from './dto/status.request.dto.js';
import type { StatusRequestDto } from './dto/status.request.dto.js';

@Controller('api/v1/catalog/items')
export class ChangeItemStatusPutController {
  constructor(private readonly changer: ItemStatusChanger) {}

  @Put(':itemId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.items.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, itemId, active: body.active });
  }
}
