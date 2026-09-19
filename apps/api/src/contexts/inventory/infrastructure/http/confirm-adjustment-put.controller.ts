import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { AdjustmentConfirmer } from '../../application/confirm-adjustment/adjustment-confirmer.js';

// Una accion propia y no un campo de estado en el cuerpo: confirmar mueve existencia, y
// eso merece su ruta, su permiso y su prueba.
@Controller('api/v1/inventory/adjustments')
export class ConfirmAdjustmentPutController {
  constructor(private readonly confirmer: AdjustmentConfirmer) {}

  @Put(':adjustmentId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjustments.confirm')
  async run(@Session() session: CurrentSession, @Param('adjustmentId') adjustmentId: string): Promise<void> {
    await this.confirmer.run({ tenantId: session.tenantId, userId: session.userId, adjustmentId });
  }
}
