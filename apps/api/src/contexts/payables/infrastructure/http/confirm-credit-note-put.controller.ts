import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SupplierCreditNoteConfirmer } from '../../application/confirm-credit-note/supplier-credit-note-confirmer.js';

@Controller('api/v1/payables/credit-notes')
export class ConfirmSupplierCreditNotePutController {
  constructor(private readonly useCase: SupplierCreditNoteConfirmer) {}

  @Put(':creditNoteId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.creditnotes.confirm')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
  ): Promise<void> {
    await this.useCase.run({ creditNoteId, tenantId: session.tenantId, userId: session.userId });
  }
}
