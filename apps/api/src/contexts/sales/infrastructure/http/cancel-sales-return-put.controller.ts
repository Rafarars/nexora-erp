import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SalesReturnCanceller } from '../../application/cancel-return/sales-return-canceller.js';

@Controller('api/v1/sales/returns')
export class CancelSalesReturnPutController {
  constructor(private readonly useCase: SalesReturnCanceller) {}

  @Put(':returnId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.returns.cancel')
  async run(@Session() session: CurrentSession, @Param('returnId') returnId: string): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, returnId });
  }
}
