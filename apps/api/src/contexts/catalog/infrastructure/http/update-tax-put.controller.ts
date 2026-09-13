import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TaxUpdater } from '../../application/update-tax/tax-updater.js';
import { taxRequestSchema } from './dto/tax.request.dto.js';
import type { TaxRequestDto } from './dto/tax.request.dto.js';

@Controller('api/v1/catalog/taxes')
export class UpdateTaxPutController {
  constructor(private readonly updater: TaxUpdater) {}

  @Put(':taxId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.taxes.update')
  async run(
    @Session() session: CurrentSession,
    @Param('taxId') taxId: string,
    @Body(new ZodValidationPipe(taxRequestSchema)) body: TaxRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, taxId, tenantId: session.tenantId });
  }
}
