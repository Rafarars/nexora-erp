import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { DispatchUpdater } from '../../application/update-dispatch/dispatch-updater.js';
import { dispatchUpdateSchema } from './dto/dispatch.request.dto.js';
import type { DispatchUpdateDto } from './dto/dispatch.request.dto.js';

@Controller('api/v1/sales/dispatches')
export class UpdateDispatchPutController {
  constructor(private readonly useCase: DispatchUpdater) {}

  @Put(':dispatchId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.dispatches.update')
  async run(
    @Session() session: CurrentSession,
    @Param('dispatchId') dispatchId: string,
    @Body(new ZodValidationPipe(dispatchUpdateSchema)) body: DispatchUpdateDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, dispatchId, tenantId: session.tenantId });
  }
}
