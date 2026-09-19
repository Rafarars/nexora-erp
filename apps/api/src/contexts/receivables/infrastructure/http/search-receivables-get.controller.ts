import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ReceivableSearcher } from '../../application/search-receivables/receivable-searcher.js';
import type { ReceivableSearcherResponse } from '../../application/search-receivables/receivable-searcher.js';
import { receivableQuerySchema } from './dto/receivable.query.dto.js';
import type { ReceivableQueryDto } from './dto/receivable.query.dto.js';

// Las facturas con lo que deben, por paginas y con filtros.
@Controller('api/v1/receivables/invoices')
export class SearchReceivablesGetController {
  constructor(private readonly searcher: ReceivableSearcher) {}

  @Get()
  @RequirePermission('receivables.balances.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(receivableQuerySchema)) query: ReceivableQueryDto,
  ): Promise<ReceivableSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
