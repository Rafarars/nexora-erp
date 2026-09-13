import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { MeasurementUnitStatusChanger } from '../../application/change-measurement-unit-status/measurement-unit-status-changer.js';
import { statusRequestSchema } from './dto/status.request.dto.js';
import type { StatusRequestDto } from './dto/status.request.dto.js';

@Controller('api/v1/catalog/units')
export class ChangeMeasurementUnitStatusPutController {
  constructor(private readonly changer: MeasurementUnitStatusChanger) {}

  @Put(':unitId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.units.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('unitId') unitId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, unitId, active: body.active });
  }
}
