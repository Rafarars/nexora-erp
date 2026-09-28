import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DispatchReturnQuotaFinder } from '../../application/dispatch-return-quota/dispatch-return-quota-finder.js';
import type { DispatchReturnQuotaResponse } from '../../application/dispatch-return-quota/dispatch-return-quota-finder.js';

@Controller('api/v1/sales/dispatches')
export class GetDispatchReturnQuotaGetController {
  constructor(private readonly useCase: DispatchReturnQuotaFinder) {}

  @Get(':dispatchId/return-quota')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.returns.create')
  async run(@Session() session: CurrentSession, @Param('dispatchId') dispatchId: string): Promise<DispatchReturnQuotaResponse> {
    return this.useCase.run(session.tenantId, dispatchId);
  }
}
