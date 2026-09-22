import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CreditNoteSearcher } from '../../application/search-credit-notes/credit-note-searcher.js';

@Controller('api/v1/receivables/credit-notes')
export class FindCreditNoteGetController {
  constructor(private readonly useCase: CreditNoteSearcher) {}

  @Get(':creditNoteId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.creditnotes.search')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
  ): Promise<{ creditNote: unknown }> {
    const creditNote = await this.useCase.findById({ creditNoteId, tenantId: session.tenantId });

    return { creditNote };
  }
}
