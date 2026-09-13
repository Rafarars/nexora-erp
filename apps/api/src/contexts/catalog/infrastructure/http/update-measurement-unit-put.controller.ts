import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { MeasurementUnitUpdater } from '../../application/update-measurement-unit/measurement-unit-updater.js';
import { measurementUnitRequestSchema } from './dto/measurement-unit.request.dto.js';
import type { MeasurementUnitRequestDto } from './dto/measurement-unit.request.dto.js';

@Controller('api/v1/catalog/units')
export class UpdateMeasurementUnitPutController {
  constructor(private readonly updater: MeasurementUnitUpdater) {}

  @Put(':unitId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.units.update')
  async run(
    @Session() session: CurrentSession,
    @Param('unitId') unitId: string,
    @Body(new ZodValidationPipe(measurementUnitRequestSchema)) body: MeasurementUnitRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, unitId, tenantId: session.tenantId });
  }
}
