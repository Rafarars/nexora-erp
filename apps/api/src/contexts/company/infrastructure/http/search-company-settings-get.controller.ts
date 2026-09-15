import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { CompanySettingsSearcher } from '../../application/search-company-settings/company-settings-searcher.js';
import type { CompanySettingsResponse } from '../../application/search-company-settings/company-settings-searcher.js';

@Controller('api/v1/company')
export class SearchCompanySettingsGetController {
  constructor(private readonly searcher: CompanySettingsSearcher) {}

  // Ningun permiso concreto: toda pantalla necesita la moneda, los decimales y el dia de hoy.
  @Get('settings')
  @AuthenticatedOnly()
  async run(@Session() session: CurrentSession): Promise<CompanySettingsResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
