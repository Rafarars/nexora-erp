import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseInvoiceSearcher } from '../../application/search-invoices/purchase-invoice-searcher.js';
import { purchaseInvoiceQuerySchema } from './dto/purchase-invoice.query.dto.js';
import type { PurchaseInvoiceQueryDto } from './dto/purchase-invoice.query.dto.js';

@Controller('api/v1/purchasing/invoices')
export class SearchPurchaseInvoicesGetController {
  constructor(private readonly searcher: PurchaseInvoiceSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.invoices.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(purchaseInvoiceQuerySchema)) query: PurchaseInvoiceQueryDto,
  ) {
    const result = await this.searcher.run({
      tenantId: session.tenantId,
      supplierId: query.supplierId,
      status: query.status,
      fromDate: query.from,
      toDate: query.to,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    return {
      invoices: result.invoices.map((inv) => inv.toPrimitives()),
      total: result.total,
      limit,
      offset,
      hasMore: offset + result.invoices.length < result.total,
    };
  }
}
