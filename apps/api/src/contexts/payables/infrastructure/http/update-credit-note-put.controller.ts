import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierCreditNoteUpdater } from '../../application/update-credit-note/supplier-credit-note-updater.js';
import { supplierCreditNoteRequestSchema } from './dto/supplier-credit-note.request.dto.js';
import type { SupplierCreditNoteRequestDto } from './dto/supplier-credit-note.request.dto.js';

@Controller('api/v1/payables/credit-notes')
export class UpdateSupplierCreditNotePutController {
  constructor(private readonly useCase: SupplierCreditNoteUpdater) {}

  @Put(':creditNoteId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.creditnotes.update')
  async run(
    @Session() session: CurrentSession,
    @Param('creditNoteId') creditNoteId: string,
    @Body(new ZodValidationPipe(supplierCreditNoteRequestSchema)) body: SupplierCreditNoteRequestDto,
  ): Promise<void> {
    const { date, ...rest } = body;
    await this.useCase.run({
      ...rest,
      issueDate: date ?? null,
      creditNoteId,
      tenantId: session.tenantId,
    });
  }
}
