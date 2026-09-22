import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CreditNoteConfirmer } from '../../application/confirm-credit-note/credit-note-confirmer.js';

@Controller('api/v1/receivables/credit-notes')
export class ConfirmCreditNotePutController {
  constructor(private readonly useCase: CreditNoteConfirmer) {}

  @Put(':creditNoteId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.creditnotes.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
  ): Promise<void> {
    await this.useCase.run({ creditNoteId, tenantId: session.tenantId });
  }
}
