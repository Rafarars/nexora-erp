import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { MeasurementUnitCreator } from '../../application/create-measurement-unit/measurement-unit-creator.js';
import { measurementUnitRequestSchema } from './dto/measurement-unit.request.dto.js';
import type { MeasurementUnitRequestDto } from './dto/measurement-unit.request.dto.js';

@Controller('api/v1/catalog/units')
export class CreateMeasurementUnitPostController {
  constructor(private readonly creator: MeasurementUnitCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('catalog.units.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(measurementUnitRequestSchema)) body: MeasurementUnitRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
