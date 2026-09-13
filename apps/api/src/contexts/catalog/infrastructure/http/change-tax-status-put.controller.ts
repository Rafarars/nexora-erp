import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TaxStatusChanger } from '../../application/change-tax-status/tax-status-changer.js';
import { statusRequestSchema } from './dto/status.request.dto.js';
import type { StatusRequestDto } from './dto/status.request.dto.js';

@Controller('api/v1/catalog/taxes')
export class ChangeTaxStatusPutController {
  constructor(private readonly changer: TaxStatusChanger) {}

  @Put(':taxId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.taxes.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('taxId') taxId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, taxId, active: body.active });
  }
}
