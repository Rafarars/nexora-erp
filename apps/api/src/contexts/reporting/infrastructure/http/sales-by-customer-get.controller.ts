import { Controller, Get, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SalesByCustomerReport } from '../../application/sales-by-customer/sales-by-customer-report.js';
import type { SalesByCustomerResponse } from '../../application/sales-by-customer/sales-by-customer-report.js';
import { pagedPeriodQuerySchema } from './dto/report.query.dto.js';
import type { PagedPeriodQueryDto } from './dto/report.query.dto.js';

// La pantalla pide una pagina; la exportacion no pasa por aqui y sigue trayendo todo.
const DEFAULT_PAGE = 50;

@Controller('api/v1/reports/sales-by-customer')
export class SalesByCustomerGetController {
  constructor(private readonly report: SalesByCustomerReport) {}

  @Get()
  @RequirePermission('reports.sales.search')
  async run(@Session() session: CurrentSession, @Query(new ZodValidationPipe(pagedPeriodQuerySchema)) query: PagedPeriodQueryDto): Promise<SalesByCustomerResponse> {
    return this.report.run({ tenantId: session.tenantId, from: query.from, to: query.to, limit: query.limit ?? DEFAULT_PAGE, offset: query.offset });
  }
}
