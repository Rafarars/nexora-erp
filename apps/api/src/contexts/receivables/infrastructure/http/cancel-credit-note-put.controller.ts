import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CreditNoteCanceller } from '../../application/cancel-credit-note/credit-note-canceller.js';

@Controller('api/v1/receivables/credit-notes')
export class CancelCreditNotePutController {
  constructor(private readonly useCase: CreditNoteCanceller) {}

  @Put(':creditNoteId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.creditnotes.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
  ): Promise<void> {
    await this.useCase.run({ creditNoteId, tenantId: session.tenantId });
  }
}
