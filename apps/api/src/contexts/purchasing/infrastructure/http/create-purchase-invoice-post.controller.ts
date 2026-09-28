import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseInvoiceCreator } from '../../application/create-invoice/purchase-invoice-creator.js';
import { purchaseInvoiceCreateSchema } from './dto/purchase-invoice.request.dto.js';
import type { PurchaseInvoiceCreateDto } from './dto/purchase-invoice.request.dto.js';

@Controller('api/v1/purchasing/invoices')
export class CreatePurchaseInvoicePostController {
  constructor(private readonly creator: PurchaseInvoiceCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing.invoices.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(purchaseInvoiceCreateSchema)) body: PurchaseInvoiceCreateDto,
  ): Promise<{ id: string; code: string }> {
    const invoice = await this.creator.run({ ...body, tenantId: session.tenantId });
    return { id: invoice.id.value, code: invoice.code };
  }
}
