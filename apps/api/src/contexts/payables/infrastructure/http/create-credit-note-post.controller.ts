import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierCreditNoteCreator } from '../../application/create-credit-note/supplier-credit-note-creator.js';
import { supplierCreditNoteRequestSchema } from './dto/supplier-credit-note.request.dto.js';
import type { SupplierCreditNoteRequestDto } from './dto/supplier-credit-note.request.dto.js';

@Controller('api/v1/payables/credit-notes')
export class CreateSupplierCreditNotePostController {
  constructor(private readonly useCase: SupplierCreditNoteCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('payables.creditnotes.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(supplierCreditNoteRequestSchema)) body: SupplierCreditNoteRequestDto,
  ): Promise<{ id: string; code: string }> {
    const { date, ...rest } = body;
    return this.useCase.run({
      ...rest,
      issueDate: date ?? null,
      tenantId: session.tenantId,
    });
  }
}
