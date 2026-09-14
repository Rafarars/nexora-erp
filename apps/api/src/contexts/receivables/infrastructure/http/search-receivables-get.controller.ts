import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ReceivableSearcher } from '../../application/search-receivables/receivable-searcher.js';
import type { ReceivableResponse } from '../../application/search-receivables/receivable-searcher.js';
import { receivablesQuerySchema } from './dto/receivables.query.dto.js';
import type { ReceivablesQueryDto } from './dto/receivables.query.dto.js';

// Las facturas con lo que deben, de todos los clientes o de uno.
@Controller('api/v1/receivables/invoices')
export class SearchReceivablesGetController {
  constructor(private readonly searcher: ReceivableSearcher) {}

  @Get()
  @RequirePermission('receivables.balances.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(receivablesQuerySchema)) query: ReceivablesQueryDto,
  ): Promise<{ receivables: ReceivableResponse[] }> {
    return this.searcher.run({ tenantId: session.tenantId, customerId: query.customerId });
  }
}
