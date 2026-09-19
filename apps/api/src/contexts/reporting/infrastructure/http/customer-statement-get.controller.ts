import { Controller, Get, Param, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { pagedQuerySchema } from './dto/report.query.dto.js';
import type { PagedQueryDto } from './dto/report.query.dto.js';
import { CustomerStatementReport } from '../../application/customer-statement/customer-statement-report.js';
import type { CustomerStatementResponse } from '../../application/customer-statement/customer-statement-report.js';

// La pantalla pide una pagina; la exportacion no pasa por aqui y sigue trayendo todo.
const DEFAULT_PAGE = 50;

@Controller('api/v1/reports/customers')
export class CustomerStatementGetController {
  constructor(private readonly report: CustomerStatementReport) {}

  @Get(':customerId/statement')
  @RequirePermission('reports.receivables.search')
  async run(@Session() session: CurrentSession, @Param('customerId') customerId: string, @Query(new ZodValidationPipe(pagedQuerySchema)) query: PagedQueryDto): Promise<CustomerStatementResponse> {
    return this.report.run({ tenantId: session.tenantId, customerId, limit: query.limit ?? DEFAULT_PAGE, offset: query.offset });
  }
}
