import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DefaultWarehouseSetter } from '../../application/set-default-warehouse/default-warehouse-setter.js';

// Una accion propia y no un campo del formulario de edicion: quitarle la marca a una
// bodega solo tiene sentido dandosela a otra, y eso es lo que expresa esta ruta.
@Controller('api/v1/catalog/warehouses')
export class SetDefaultWarehousePutController {
  constructor(private readonly setter: DefaultWarehouseSetter) {}

  @Put(':warehouseId/default')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.warehouses.update')
  async run(@Session() session: CurrentSession, @Param('warehouseId') warehouseId: string): Promise<void> {
    await this.setter.run({ tenantId: session.tenantId, warehouseId });
  }
}
