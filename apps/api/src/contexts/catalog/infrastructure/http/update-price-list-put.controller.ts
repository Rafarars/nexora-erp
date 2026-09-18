import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PriceListUpdater } from '../../application/update-price-list/price-list-updater.js';
import { updatePriceListRequestSchema } from './dto/price-list.request.dto.js';
import type { UpdatePriceListRequestDto } from './dto/price-list.request.dto.js';

@Controller('api/v1/catalog/price-lists')
export class UpdatePriceListPutController {
  constructor(private readonly updater: PriceListUpdater) {}

  @Put(':priceListId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.pricelists.update')
  async run(
    @Session() session: CurrentSession,
    @Param('priceListId') priceListId: string,
    @Body(new ZodValidationPipe(updatePriceListRequestSchema)) body: UpdatePriceListRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, priceListId, tenantId: session.tenantId });
  }
}
