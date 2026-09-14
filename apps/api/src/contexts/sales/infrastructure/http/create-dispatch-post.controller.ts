import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { DispatchCreator } from '../../application/create-dispatch/dispatch-creator.js';
import { dispatchCreateSchema } from './dto/dispatch.request.dto.js';
import type { DispatchCreateDto } from './dto/dispatch.request.dto.js';

@Controller('api/v1/sales/dispatches')
export class CreateDispatchPostController {
  constructor(private readonly useCase: DispatchCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales.dispatches.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(dispatchCreateSchema)) body: DispatchCreateDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, tenantId: session.tenantId });
  }
}
