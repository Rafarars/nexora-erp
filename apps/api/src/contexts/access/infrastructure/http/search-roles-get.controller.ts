import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RoleSearcher } from '../../application/search-roles/role-searcher.js';
import type { RoleSearcherResponse } from '../../application/search-roles/role-searcher.response.js';

@Controller('api/v1/roles')
export class SearchRolesGetController {
  constructor(private readonly searcher: RoleSearcher) {}

  @Get()
  @RequirePermission('access.roles.search')
  async run(@Session() session: CurrentSession): Promise<RoleSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
