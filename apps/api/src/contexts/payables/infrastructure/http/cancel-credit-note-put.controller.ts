import { Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SupplierCreditNoteCanceller } from '../../application/cancel-credit-note/supplier-credit-note-canceller.js';

@Controller('api/v1/payables/credit-notes')
export class CancelSupplierCreditNotePutController {
  constructor(private readonly useCase: SupplierCreditNoteCanceller) {}

  @Put(':creditNoteId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.creditnotes.cancel')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
  ): Promise<void> {
    await this.useCase.run({ creditNoteId, tenantId: session.tenantId });
  }
}
