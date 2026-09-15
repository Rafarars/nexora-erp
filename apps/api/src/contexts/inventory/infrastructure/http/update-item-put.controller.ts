import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ItemUpdater } from '../../application/update-item/item-updater.js';
import { itemRequestSchema } from './dto/item.request.dto.js';
import type { ItemRequestDto } from './dto/item.request.dto.js';

@Controller('api/v1/inventory/items')
export class UpdateItemPutController {
  constructor(private readonly updater: ItemUpdater) {}

  @Put(':itemId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.items.update')
  async run(
    @Session() session: CurrentSession,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(itemRequestSchema)) body: ItemRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, itemId, tenantId: session.tenantId });
  }
}
