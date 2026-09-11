import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { PermissionSearcher } from '../../application/search-permissions/permission-searcher.js';
import type { PermissionSearcherResponse } from '../../application/search-permissions/permission-searcher.js';

@Controller('api/v1/permissions')
export class SearchPermissionsGetController {
  constructor(private readonly searcher: PermissionSearcher) {}

  // El catalogo es el mismo para todas las empresas; quien puede ver roles necesita
  // verlo para entender que concede cada uno.
  @Get()
  @RequirePermission('access.roles.search')
  async run(): Promise<PermissionSearcherResponse> {
    return this.searcher.run();
  }
}
