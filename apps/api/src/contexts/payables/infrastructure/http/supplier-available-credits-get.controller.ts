import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { SupplierAvailableCreditsFinder } from '../../application/supplier-available-credits/supplier-available-credits-finder.js';

@Controller('api/v1/payables/suppliers')
export class SupplierAvailableCreditsGetController {
  constructor(private readonly useCase: SupplierAvailableCreditsFinder) {}

  @Get(':supplierId/available-credits')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payables.payments.create')
  async run(
    @Session() session: CurrentSession,
    @Param('supplierId') supplierId: string,
  ): Promise<{ credits: unknown[] }> {
    const result = await this.useCase.run({ supplierId, tenantId: session.tenantId });

    return { credits: result.notes };
  }
}
