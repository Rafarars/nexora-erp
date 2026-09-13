import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { WarehouseUpdater } from '../../application/update-warehouse/warehouse-updater.js';
import { warehouseRequestSchema } from './dto/warehouse.request.dto.js';
import type { WarehouseRequestDto } from './dto/warehouse.request.dto.js';

@Controller('api/v1/catalog/warehouses')
export class UpdateWarehousePutController {
  constructor(private readonly updater: WarehouseUpdater) {}

  @Put(':warehouseId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.warehouses.update')
  async run(
    @Session() session: CurrentSession,
    @Param('warehouseId') warehouseId: string,
    @Body(new ZodValidationPipe(warehouseRequestSchema)) body: WarehouseRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, warehouseId, tenantId: session.tenantId });
  }
}
