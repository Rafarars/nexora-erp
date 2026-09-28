import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ThreeWayMatcher } from '../../application/three-way-match/three-way-matcher.js';

@Controller('api/v1/purchasing/invoices')
export class ThreeWayMatchGetController {
  constructor(private readonly matcher: ThreeWayMatcher) {}

  @Get(':invoiceId/three-way-match')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.invoices.search')
  async run(
    @Session() session: CurrentSession,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.matcher.run(session.tenantId, invoiceId);
  }
}
