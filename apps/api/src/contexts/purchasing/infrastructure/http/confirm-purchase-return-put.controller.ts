import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseReturnConfirmer } from '../../application/confirm-return/purchase-return-confirmer.js';

@Controller('api/v1/purchasing/returns')
export class ConfirmPurchaseReturnPutController {
  constructor(private readonly useCase: PurchaseReturnConfirmer) {}

  @Put(':returnId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.returns.confirm')
  async run(@Session() session: CurrentSession, @Param('returnId') returnId: string): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, returnId });
  }
}
