import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ItemCreator } from '../../application/create-item/item-creator.js';
import { itemRequestSchema } from './dto/item.request.dto.js';
import type { ItemRequestDto } from './dto/item.request.dto.js';

@Controller('api/v1/catalog/items')
export class CreateItemPostController {
  constructor(private readonly creator: ItemCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('catalog.items.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(itemRequestSchema)) body: ItemRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
