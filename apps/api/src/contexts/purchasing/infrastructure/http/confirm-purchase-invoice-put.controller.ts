import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseInvoiceConfirmer } from '../../application/confirm-invoice/purchase-invoice-confirmer.js';

@Controller('api/v1/purchasing/invoices')
export class ConfirmPurchaseInvoicePutController {
  constructor(private readonly confirmer: PurchaseInvoiceConfirmer) {}

  @Put(':invoiceId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.invoices.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
  ): Promise<{ id: string; status: string }> {
    const invoice = await this.confirmer.run({ tenantId: session.tenantId, invoiceId });
    return { id: invoice.id.value, status: invoice.currentStatus };
  }
}
