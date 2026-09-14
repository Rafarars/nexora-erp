import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DispatchCanceller } from '../../application/cancel-dispatch/dispatch-canceller.js';

@Controller('api/v1/sales/dispatches')
export class CancelDispatchPutController {
  constructor(private readonly useCase: DispatchCanceller) {}

  @Put(':dispatchId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.dispatches.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('dispatchId') dispatchId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, dispatchId });
  }
}
