import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PriceListStatusChanger } from '../../application/change-price-list-status/price-list-status-changer.js';
import { statusRequestSchema } from './dto/status.request.dto.js';
import type { StatusRequestDto } from './dto/status.request.dto.js';

@Controller('api/v1/catalog/price-lists')
export class ChangePriceListStatusPutController {
  constructor(private readonly changer: PriceListStatusChanger) {}

  @Put(':priceListId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.pricelists.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('priceListId') priceListId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, priceListId, active: body.active });
  }
}
