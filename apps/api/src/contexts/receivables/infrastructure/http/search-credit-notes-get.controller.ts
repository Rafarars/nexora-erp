import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CreditNoteSearcher } from '../../application/search-credit-notes/credit-note-searcher.js';
import { creditNoteQuerySchema } from './dto/credit-note.query.dto.js';
import type { CreditNoteQueryDto } from './dto/credit-note.query.dto.js';

@Controller('api/v1/receivables/credit-notes')
export class SearchCreditNotesGetController {
  constructor(private readonly useCase: CreditNoteSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.creditnotes.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(creditNoteQuerySchema)) query: CreditNoteQueryDto,
  ): Promise<{ creditNotes: unknown[]; total: number }> {
    return this.useCase.search({ ...query, tenantId: session.tenantId });
  }
}
