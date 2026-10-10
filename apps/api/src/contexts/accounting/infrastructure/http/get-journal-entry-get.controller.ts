import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import {
  GetJournalEntryResponse,
  GetJournalEntryUseCase,
} from '../../application/get-journal-entry/get-journal-entry.use-case.js';

@Controller('api/v1/accounting/entries')
export class GetJournalEntryGetController {
  constructor(private readonly useCase: GetJournalEntryUseCase) {}

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounting.entries.read')
  async run(
    @Session() session: CurrentSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GetJournalEntryResponse> {
    return this.useCase.execute({
      tenantId: session.tenantId,
      id,
    });
  }
}
