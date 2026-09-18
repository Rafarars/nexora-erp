import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PriceListCreator } from '../../application/create-price-list/price-list-creator.js';
import { createPriceListRequestSchema } from './dto/price-list.request.dto.js';
import type { CreatePriceListRequestDto } from './dto/price-list.request.dto.js';

@Controller('api/v1/catalog/price-lists')
export class CreatePriceListPostController {
  constructor(private readonly creator: PriceListCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('catalog.pricelists.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(createPriceListRequestSchema)) body: CreatePriceListRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
