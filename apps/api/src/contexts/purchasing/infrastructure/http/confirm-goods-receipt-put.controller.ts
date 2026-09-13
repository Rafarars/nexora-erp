import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { GoodsReceiptConfirmer } from '../../application/confirm-receipt/goods-receipt-confirmer.js';

// Confirmar una entrada sube la existencia: accion propia con su permiso.
@Controller('api/v1/purchasing/receipts')
export class ConfirmGoodsReceiptPutController {
  constructor(private readonly confirmer: GoodsReceiptConfirmer) {}

  @Put(':receiptId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.receipts.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('receiptId') receiptId: string,
  ): Promise<void> {
    await this.confirmer.run({ tenantId: session.tenantId, receiptId });
  }
}
