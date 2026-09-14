import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { InvoiceIssuer } from '../../application/issue-invoice/invoice-issuer.js';
import { invoiceIssueSchema } from './dto/invoice.request.dto.js';
import type { InvoiceIssueDto } from './dto/invoice.request.dto.js';

@Controller('api/v1/sales/invoices')
export class IssueInvoicePostController {
  constructor(private readonly useCase: InvoiceIssuer) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales.invoices.issue')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(invoiceIssueSchema)) body: InvoiceIssueDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, tenantId: session.tenantId });
  }
}
