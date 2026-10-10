import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  SearchJournalEntriesResponse,
  SearchJournalEntriesUseCase,
} from '../../application/search-journal-entries/search-journal-entries.use-case.js';
import { searchJournalEntriesQuerySchema } from './dto/journal-entry.request.dto.js';
import type { SearchJournalEntriesQueryDto } from './dto/journal-entry.request.dto.js';

@Controller('api/v1/accounting/entries')
export class SearchJournalEntriesGetController {
  constructor(private readonly useCase: SearchJournalEntriesUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounting.entries.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(searchJournalEntriesQuerySchema)) query: SearchJournalEntriesQueryDto,
  ): Promise<SearchJournalEntriesResponse> {
    return this.useCase.execute({
      tenantId: session.tenantId,
      originType: query.originType,
      originId: query.originId,
      from: query.from,
      to: query.to,
      accountId: query.accountId,
      query: query.query,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
