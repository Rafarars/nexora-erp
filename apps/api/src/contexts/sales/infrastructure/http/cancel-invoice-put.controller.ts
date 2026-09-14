import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { InvoiceCanceller } from '../../application/cancel-invoice/invoice-canceller.js';

@Controller('api/v1/sales/invoices')
export class CancelInvoicePutController {
  constructor(private readonly useCase: InvoiceCanceller) {}

  @Put(':invoiceId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.invoices.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
  ): Promise<void> {
    await this.useCase.run({ tenantId: session.tenantId, invoiceId });
  }
}
