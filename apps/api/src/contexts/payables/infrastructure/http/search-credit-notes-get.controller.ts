import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierCreditNoteSearcher } from '../../application/search-credit-notes/supplier-credit-note-searcher.js';
import { supplierCreditNoteQuerySchema } from './dto/supplier-credit-note.query.dto.js';
import type { SupplierCreditNoteQueryDto } from './dto/supplier-credit-note.query.dto.js';

@Controller('api/v1/payables/credit-notes')
export class SearchSupplierCreditNotesGetController {
  constructor(private readonly useCase: SupplierCreditNoteSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.creditnotes.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(supplierCreditNoteQuerySchema)) query: SupplierCreditNoteQueryDto,
  ): Promise<{ creditNotes: unknown[]; total: number }> {
    return this.useCase.search({ ...query, tenantId: session.tenantId });
  }
}
