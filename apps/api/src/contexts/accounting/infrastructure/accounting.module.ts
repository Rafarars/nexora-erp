import { Module } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { CreateAccountUseCase } from '../application/create-account/create-account.use-case.js';
import { SearchAccountsUseCase } from '../application/search-accounts/search-accounts.use-case.js';
import { UpdateAccountUseCase } from '../application/update-account/update-account.use-case.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account/account.repository.js';
import { CreateAccountPostController } from './http/create-account-post.controller.js';
import { SearchAccountsGetController } from './http/search-accounts-get.controller.js';
import { UpdateAccountPutController } from './http/update-account-put.controller.js';
import { ChangeAccountStatusPutController } from './http/change-account-status-put.controller.js';
import { PrismaAccountRepository } from './persistence/prisma-account.repository.js';

@Module({
  imports: [SharedModule, PrismaModule],
  controllers: [
    CreateAccountPostController,
    UpdateAccountPutController,
    ChangeAccountStatusPutController,
    SearchAccountsGetController,
  ],
  providers: [
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: PrismaAccountRepository,
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
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    CreateAccountUseCase,
    UpdateAccountUseCase,
    SearchAccountsUseCase,
  ],
})
export class AccountingModule {}
