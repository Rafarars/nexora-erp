import { Module } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { CreateAccountUseCase } from '../application/create-account/create-account.use-case.js';
import { GetJournalEntryUseCase } from '../application/get-journal-entry/get-journal-entry.use-case.js';
import { SearchAccountsUseCase } from '../application/search-accounts/search-accounts.use-case.js';
import { SearchJournalEntriesUseCase } from '../application/search-journal-entries/search-journal-entries.use-case.js';
import { UpdateAccountUseCase } from '../application/update-account/update-account.use-case.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account/account.repository.js';
import { ACCOUNTING_CODE_SEQUENCE } from '../domain/journal/accounting-code-sequence.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal/journal-entry.repository.js';
import { ChangeAccountStatusPutController } from './http/change-account-status-put.controller.js';
import { CreateAccountPostController } from './http/create-account-post.controller.js';
import { GetJournalEntryGetController } from './http/get-journal-entry-get.controller.js';
import { SearchAccountsGetController } from './http/search-accounts-get.controller.js';
import { SearchJournalEntriesGetController } from './http/search-journal-entries-get.controller.js';
import { UpdateAccountPutController } from './http/update-account-put.controller.js';
import { DOCUMENT_ACCOUNTING_POSTING } from '../../../shared/prisma/document-accounting-posting.js';
import { PrismaAccountRepository } from './persistence/prisma-account.repository.js';
import { PrismaAccountingCodeSequence } from './persistence/prisma-accounting-code-sequence.js';
import { PrismaDocumentAccountingPosting } from './persistence/prisma-document-accounting-posting.js';
import { PrismaJournalEntryRepository } from './persistence/prisma-journal-entry.repository.js';

@Module({
  imports: [SharedModule, PrismaModule],
  controllers: [
    CreateAccountPostController,
    UpdateAccountPutController,
    ChangeAccountStatusPutController,
    SearchAccountsGetController,
    SearchJournalEntriesGetController,
    GetJournalEntryGetController,
  ],
  providers: [
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: PrismaAccountRepository,
    },
    {
      provide: JOURNAL_ENTRY_REPOSITORY,
      useClass: PrismaJournalEntryRepository,
    },
    {
      provide: ACCOUNTING_CODE_SEQUENCE,
      useClass: PrismaAccountingCodeSequence,
    },
    {
      provide: DOCUMENT_ACCOUNTING_POSTING,
      useClass: PrismaDocumentAccountingPosting,
    },
    {
      provide: CreateAccountUseCase,
      useFactory: (repo: AccountRepository, idGen: IdGenerator) => new CreateAccountUseCase(repo, idGen),
      inject: [ACCOUNT_REPOSITORY, ID_GENERATOR],
    },
    {
      provide: UpdateAccountUseCase,
      useFactory: (repo: AccountRepository) => new UpdateAccountUseCase(repo),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: SearchAccountsUseCase,
      useFactory: (repo: AccountRepository) => new SearchAccountsUseCase(repo),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: SearchJournalEntriesUseCase,
      useFactory: (repo: JournalEntryRepository) => new SearchJournalEntriesUseCase(repo),
      inject: [JOURNAL_ENTRY_REPOSITORY],
    },
    {
      provide: GetJournalEntryUseCase,
      useFactory: (entries: JournalEntryRepository, accounts: AccountRepository) =>
        new GetJournalEntryUseCase(entries, accounts),
      inject: [JOURNAL_ENTRY_REPOSITORY, ACCOUNT_REPOSITORY],
    },
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    JOURNAL_ENTRY_REPOSITORY,
    ACCOUNTING_CODE_SEQUENCE,
    DOCUMENT_ACCOUNTING_POSTING,
    CreateAccountUseCase,
    UpdateAccountUseCase,
    SearchAccountsUseCase,
    SearchJournalEntriesUseCase,
    GetJournalEntryUseCase,
  ],
})
export class AccountingModule {}

