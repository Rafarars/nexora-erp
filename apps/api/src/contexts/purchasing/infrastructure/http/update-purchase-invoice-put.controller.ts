import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseInvoiceUpdater } from '../../application/update-invoice/purchase-invoice-updater.js';
import { purchaseInvoiceUpdateSchema } from './dto/purchase-invoice.request.dto.js';
import type { PurchaseInvoiceUpdateDto } from './dto/purchase-invoice.request.dto.js';

@Controller('api/v1/purchasing/invoices')
export class UpdatePurchaseInvoicePutController {
  constructor(private readonly updater: PurchaseInvoiceUpdater) {}

  @Put(':invoiceId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.invoices.update')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(purchaseInvoiceUpdateSchema)) body: PurchaseInvoiceUpdateDto,
  ): Promise<{ id: string }> {
    const invoice = await this.updater.run({ ...body, tenantId: session.tenantId, invoiceId });
    return { id: invoice.id.value };
  }
}
