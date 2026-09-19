import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { AvailabilitySearcher } from '../../application/search-availability/availability-searcher.js';
import type { AvailabilitySearcherResponse } from '../../application/search-availability/availability-searcher.js';
import { availabilityQuerySchema } from './dto/availability.query.dto.js';
import type { AvailabilityQueryDto } from './dto/availability.query.dto.js';

@Controller('api/v1/sales/availability')
export class SearchAvailabilityGetController {
  constructor(private readonly searcher: AvailabilitySearcher) {}

  @Get()
  @RequirePermission('sales.availability.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQueryDto,
  ): Promise<AvailabilitySearcherResponse> {
    return this.searcher.run({ tenantId: session.tenantId, ...query });
  }
}
