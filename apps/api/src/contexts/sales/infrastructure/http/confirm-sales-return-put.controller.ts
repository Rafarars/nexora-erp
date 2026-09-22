import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SalesReturnConfirmer } from '../../application/confirm-return/sales-return-confirmer.js';

@Controller('api/v1/sales/returns')
export class ConfirmSalesReturnPutController {
  constructor(private readonly useCase: SalesReturnConfirmer) {}

  @Put(':returnId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.returns.confirm')
  async run(@Session() session: CurrentSession, @Param('returnId') returnId: string): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, returnId });
  }
}
