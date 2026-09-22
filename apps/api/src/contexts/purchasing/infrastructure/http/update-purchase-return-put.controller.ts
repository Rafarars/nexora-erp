import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseReturnUpdater } from '../../application/update-return/purchase-return-updater.js';
import { purchaseReturnUpdateSchema } from './dto/purchase-return.request.dto.js';
import type { PurchaseReturnUpdateDto } from './dto/purchase-return.request.dto.js';

@Controller('api/v1/purchasing/returns')
export class UpdatePurchaseReturnPutController {
  constructor(private readonly useCase: PurchaseReturnUpdater) {}

  @Put(':returnId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.returns.update')
  async run(
    @Session() session: CurrentSession,
    @Param('returnId') returnId: string,
    @Body(new ZodValidationPipe(purchaseReturnUpdateSchema)) body: PurchaseReturnUpdateDto,
  ): Promise<void> {
    await this.useCase.run({ ...body, returnId, tenantId: session.tenantId });
  }
}
