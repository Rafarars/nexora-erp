import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SupplierStatementSearcher } from '../../application/search-supplier-statement/supplier-statement-searcher.js';

@Controller('api/v1/payables/suppliers')
export class SearchSupplierStatementGetController {
  constructor(private readonly searcher: SupplierStatementSearcher) {}

  @Get(':supplierId/statement')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.statements.search')
  async run(@Session() session: CurrentSession, @Param('supplierId') supplierId: string) {
    return this.searcher.run({
      tenantId: session.tenantId,
      supplierId,
    });
  }
}
