import { Controller, Get } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { MeasurementUnitSearcher } from '../../application/search-measurement-units/measurement-unit-searcher.js';
import type { MeasurementUnitSearcherResponse } from '../../application/search-measurement-units/measurement-unit-searcher.js';

@Controller('api/v1/catalog/units')
export class SearchMeasurementUnitsGetController {
  constructor(private readonly searcher: MeasurementUnitSearcher) {}

  @Get()
  @RequirePermission('catalog.units.search')
  async run(@Session() session: CurrentSession): Promise<MeasurementUnitSearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId });
  }
}
