import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SearchAccountsUseCase, AccountTreeNode } from '../../application/search-accounts/search-accounts.use-case.js';
import { AccountPrimitives } from '../../domain/account/account.entity.js';
import type { AccountType } from '../../domain/account/account-type.vo.js';
import { searchAccountsQuerySchema } from './dto/account.request.dto.js';
import type { SearchAccountsQueryDto } from './dto/account.request.dto.js';

@Controller('api/v1/accounting/accounts')
export class SearchAccountsGetController {
  constructor(private readonly useCase: SearchAccountsUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounting.accounts.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(searchAccountsQuerySchema)) query: SearchAccountsQueryDto,
  ): Promise<AccountPrimitives[] | AccountTreeNode[]> {
    if (query.tree === 'true') {
      return this.useCase.getTree(session.tenantId);
    }

    return this.useCase.execute({
      tenantId: session.tenantId,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
      type: query.type as AccountType | undefined,
    });
  }
}
