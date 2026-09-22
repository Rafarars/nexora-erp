import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CreditNoteUpdater } from '../../application/update-credit-note/credit-note-updater.js';
import { creditNoteRequestSchema } from './dto/credit-note.request.dto.js';
import type { CreditNoteRequestDto } from './dto/credit-note.request.dto.js';

@Controller('api/v1/receivables/credit-notes')
export class UpdateCreditNotePutController {
  constructor(private readonly useCase: CreditNoteUpdater) {}

  @Put(':creditNoteId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('receivables.creditnotes.update')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
    @Body(new ZodValidationPipe(creditNoteRequestSchema)) body: CreditNoteRequestDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, creditNoteId, tenantId: session.tenantId });
  }
}
