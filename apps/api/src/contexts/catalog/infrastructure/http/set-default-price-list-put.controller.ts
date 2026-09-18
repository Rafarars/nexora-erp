import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DefaultPriceListSetter } from '../../application/set-default-price-list/default-price-list-setter.js';

// Una accion propia y no un campo del formulario: quitarle la marca a una lista solo tiene sentido
// dandosela a otra.
@Controller('api/v1/catalog/price-lists')
export class SetDefaultPriceListPutController {
  constructor(private readonly setter: DefaultPriceListSetter) {}

  @Put(':priceListId/default')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.pricelists.update')
  async run(@Session() session: CurrentSession, @Param('priceListId') priceListId: string): Promise<void> {
    await this.setter.run({ tenantId: session.tenantId, priceListId });
  }
}
