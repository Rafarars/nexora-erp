import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PurchaseReturnCreator } from '../../application/create-return/purchase-return-creator.js';
import { purchaseReturnCreateSchema } from './dto/purchase-return.request.dto.js';
import type { PurchaseReturnCreateDto } from './dto/purchase-return.request.dto.js';

@Controller('api/v1/purchasing/returns')
export class CreatePurchaseReturnPostController {
  constructor(private readonly useCase: PurchaseReturnCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing.returns.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(purchaseReturnCreateSchema)) body: PurchaseReturnCreateDto,
  ): Promise<{ id: string }> {
    const id = await this.useCase.run({ ...body, tenantId: session.tenantId });
    return { id };
  }
}
