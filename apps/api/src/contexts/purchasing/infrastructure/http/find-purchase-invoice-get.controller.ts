import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PurchaseInvoiceFinder } from '../../application/find-invoice/purchase-invoice-finder.js';
import { PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Controller('api/v1/purchasing/invoices')
export class FindPurchaseInvoiceGetController {
  constructor(private readonly finder: PurchaseInvoiceFinder) {}

  @Get(':invoiceId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.invoices.search')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
  ) {
    const invoice = await this.finder.find(TenantId.of(session.tenantId), PurchaseInvoiceId.of(invoiceId));
    return { invoice: invoice.toPrimitives() };
  }
}
