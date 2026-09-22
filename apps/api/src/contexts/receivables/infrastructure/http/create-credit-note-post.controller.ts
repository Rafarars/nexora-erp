import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CreditNoteCreator } from '../../application/create-credit-note/credit-note-creator.js';
import { creditNoteRequestSchema } from './dto/credit-note.request.dto.js';
import type { CreditNoteRequestDto } from './dto/credit-note.request.dto.js';

@Controller('api/v1/receivables/credit-notes')
export class CreateCreditNotePostController {
  constructor(private readonly useCase: CreditNoteCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('receivables.creditnotes.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(creditNoteRequestSchema)) body: CreditNoteRequestDto,
  ): Promise<{ id: string; code: string }> {
    return this.useCase.run({ ...body, tenantId: session.tenantId });
  }
}
