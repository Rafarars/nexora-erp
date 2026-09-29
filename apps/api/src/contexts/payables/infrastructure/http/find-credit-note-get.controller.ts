import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SupplierCreditNoteSearcher } from '../../application/search-credit-notes/supplier-credit-note-searcher.js';

@Controller('api/v1/payables/credit-notes')
export class FindSupplierCreditNoteGetController {
  constructor(private readonly useCase: SupplierCreditNoteSearcher) {}

  @Get(':creditNoteId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.creditnotes.search')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
  ): Promise<{ creditNote: unknown }> {
    const creditNote = await this.useCase.findById({ creditNoteId, tenantId: session.tenantId });

    return { creditNote };
  }
}
