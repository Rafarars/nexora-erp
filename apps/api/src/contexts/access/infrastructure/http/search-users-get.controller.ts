import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { UserSearcher } from '../../application/search-tenant-users/user-searcher.js';
import type { UserSearcherResponse } from '../../application/search-tenant-users/user-searcher.response.js';

@Controller('api/v1/users')
export class SearchUsersGetController {
  constructor(private readonly searcher: UserSearcher) {}

  @Get()
  @RequirePermission('access.users.search')
  async run(@Session() session: CurrentSession): Promise<UserSearcherResponse> {
    // La empresa sale del token: no hay forma de pedir los usuarios de otra.
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
