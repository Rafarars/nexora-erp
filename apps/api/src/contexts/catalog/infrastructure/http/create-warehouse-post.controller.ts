import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { WarehouseCreator } from '../../application/create-warehouse/warehouse-creator.js';
import { warehouseRequestSchema } from './dto/warehouse.request.dto.js';
import type { WarehouseRequestDto } from './dto/warehouse.request.dto.js';

@Controller('api/v1/catalog/warehouses')
export class CreateWarehousePostController {
  constructor(private readonly creator: WarehouseCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('catalog.warehouses.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(warehouseRequestSchema)) body: WarehouseRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
