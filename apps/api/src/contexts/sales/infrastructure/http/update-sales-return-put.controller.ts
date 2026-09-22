import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesReturnUpdater } from '../../application/update-return/sales-return-updater.js';
import { salesReturnUpdateSchema } from './dto/sales-return.request.dto.js';
import type { SalesReturnUpdateDto } from './dto/sales-return.request.dto.js';

@Controller('api/v1/sales/returns')
export class UpdateSalesReturnPutController {
  constructor(private readonly useCase: SalesReturnUpdater) {}

  @Put(':returnId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.returns.update')
  async run(
    @Session() session: CurrentSession,
    @Param('returnId') returnId: string,
    @Body(new ZodValidationPipe(salesReturnUpdateSchema)) body: SalesReturnUpdateDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, returnId, tenantId: session.tenantId });
  }
}
