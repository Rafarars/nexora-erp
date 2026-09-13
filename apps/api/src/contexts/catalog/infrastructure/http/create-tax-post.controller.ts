import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TaxCreator } from '../../application/create-tax/tax-creator.js';
import { taxRequestSchema } from './dto/tax.request.dto.js';
import type { TaxRequestDto } from './dto/tax.request.dto.js';

@Controller('api/v1/catalog/taxes')
export class CreateTaxPostController {
  constructor(private readonly creator: TaxCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('catalog.taxes.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(taxRequestSchema)) body: TaxRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
