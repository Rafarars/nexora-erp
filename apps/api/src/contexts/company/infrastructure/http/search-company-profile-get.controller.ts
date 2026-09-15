import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { CompanyProfileSearcher } from '../../application/search-company-profile/company-profile-searcher.js';
import type { CompanyProfileResponse } from '../../application/search-company-profile/company-profile-searcher.js';

@Controller('api/v1/company')
export class SearchCompanyProfileGetController {
  constructor(private readonly searcher: CompanyProfileSearcher) {}

  @Get('profile')
  @RequirePermission('company.profile.search')
  async run(@Session() session: CurrentSession): Promise<CompanyProfileResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
