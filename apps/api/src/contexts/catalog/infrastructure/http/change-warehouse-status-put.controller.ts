import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { WarehouseStatusChanger } from '../../application/change-warehouse-status/warehouse-status-changer.js';
import { statusRequestSchema } from './dto/status.request.dto.js';
import type { StatusRequestDto } from './dto/status.request.dto.js';

@Controller('api/v1/catalog/warehouses')
export class ChangeWarehouseStatusPutController {
  constructor(private readonly changer: WarehouseStatusChanger) {}

  @Put(':warehouseId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.warehouses.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('warehouseId') warehouseId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, warehouseId, active: body.active });
  }
}
