import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseInvoiceCanceller } from '../../application/cancel-invoice/purchase-invoice-canceller.js';

@Controller('api/v1/purchasing/invoices')
export class CancelPurchaseInvoicePutController {
  constructor(private readonly canceller: PurchaseInvoiceCanceller) {}

  @Put(':invoiceId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.invoices.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
  ): Promise<{ id: string; status: string }> {
    const invoice = await this.canceller.run({
      tenantId: session.tenantId,
      invoiceId,
      userId: session.userId,
    });
    return { id: invoice.id.value, status: invoice.currentStatus };
  }
}
