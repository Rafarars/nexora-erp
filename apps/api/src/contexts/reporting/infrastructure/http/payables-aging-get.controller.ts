import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { pagedQuerySchema } from './dto/report.query.dto.js';
import type { PagedQueryDto } from './dto/report.query.dto.js';
import { PayablesAgingReport } from '../../application/payables-aging/payables-aging-report.js';
import type { PayablesAgingResponse } from '../../application/payables-aging/payables-aging-report.js';

// La pantalla pide una pagina; la exportacion no pasa por aqui y sigue trayendo todo.
const DEFAULT_PAGE = 50;

@Controller('api/v1/reports/payables-aging')
export class PayablesAgingGetController {
  constructor(private readonly report: PayablesAgingReport) {}

  @Get()
  @RequirePermission('payables.balances.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(pagedQuerySchema)) query: PagedQueryDto): Promise<PayablesAgingResponse> {
    return this.report.run({ tenantId: session.tenantId, limit: query.limit ?? DEFAULT_PAGE, offset: query.offset });
  }
}
