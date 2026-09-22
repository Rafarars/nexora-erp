import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseReturnCanceller } from '../../application/cancel-return/purchase-return-canceller.js';

@Controller('api/v1/purchasing/returns')
export class CancelPurchaseReturnPutController {
  constructor(private readonly useCase: PurchaseReturnCanceller) {}

  @Put(':returnId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.returns.cancel')
  async run(@Session() session: CurrentSession, @Param('returnId') returnId: string): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, returnId });
  }
}
