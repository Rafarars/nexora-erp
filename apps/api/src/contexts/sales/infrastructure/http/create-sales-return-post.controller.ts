import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesReturnCreator } from '../../application/create-return/sales-return-creator.js';
import { salesReturnCreateSchema } from './dto/sales-return.request.dto.js';
import type { SalesReturnCreateDto } from './dto/sales-return.request.dto.js';

@Controller('api/v1/sales/returns')
export class CreateSalesReturnPostController {
  constructor(private readonly useCase: SalesReturnCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales.returns.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(salesReturnCreateSchema)) body: SalesReturnCreateDto,
  ): Promise<{ id: string }> {
    const id = await this.useCase.run({ ...body, tenantId: session.tenantId });
    return { id };
  }
}
