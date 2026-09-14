import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { DispatchConfirmer } from '../../application/confirm-dispatch/dispatch-confirmer.js';

// Confirmar un despacho baja la existencia: accion propia con su permiso.
@Controller('api/v1/sales/dispatches')
export class ConfirmDispatchPutController {
  constructor(private readonly useCase: DispatchConfirmer) {}

  @Put(':dispatchId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.dispatches.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('dispatchId') dispatchId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, dispatchId });
  }
}
