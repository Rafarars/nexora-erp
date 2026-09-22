import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseReturnSearcher } from '../../application/search-returns/purchase-return-searcher.js';
import type { PurchaseReturnSearcherResponse } from '../../application/search-returns/purchase-return-searcher.js';
import { purchaseReturnQuerySchema } from './dto/purchase-return.query.dto.js';
import type { PurchaseReturnQueryDto } from './dto/purchase-return.query.dto.js';

@Controller('api/v1/purchasing/returns')
export class SearchPurchaseReturnsGetController {
  constructor(private readonly useCase: PurchaseReturnSearcher) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.returns.search')
  async run(
    @Session() session: CurrentSession,
    @Query(new ZodValidationPipe(purchaseReturnQuerySchema)) query: PurchaseReturnQueryDto,
  ): Promise<PurchaseReturnSearcherResponse> {
    return this.useCase.run({ ...query, tenantId: session.tenantId });
  }
}
