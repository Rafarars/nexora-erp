import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ReceiptReturnQuotaFinder } from '../../application/receipt-return-quota/receipt-return-quota-finder.js';
import type { ReceiptReturnQuotaResponse } from '../../application/receipt-return-quota/receipt-return-quota-finder.js';

@Controller('api/v1/purchasing/receipts')
export class GetReceiptReturnQuotaGetController {
  constructor(private readonly useCase: ReceiptReturnQuotaFinder) {}

  @Get(':receiptId/return-quota')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.returns.create')
  async run(@Session() session: CurrentSession, @Param('receiptId') receiptId: string): Promise<ReceiptReturnQuotaResponse> {
    return this.useCase.run(session.tenantId, receiptId);
  }
}
