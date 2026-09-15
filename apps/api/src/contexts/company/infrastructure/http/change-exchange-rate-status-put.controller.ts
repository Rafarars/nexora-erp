import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ExchangeRateStatusChanger } from '../../application/change-exchange-rate-status/exchange-rate-status-changer.js';
import { rateStatusRequestSchema } from './dto/company.request.dto.js';
import type { RateStatusRequestDto } from './dto/company.request.dto.js';

@Controller('api/v1/company')
export class ChangeExchangeRateStatusPutController {
  constructor(private readonly changer: ExchangeRateStatusChanger) {}

  @Put('exchange-rates/:rateId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company.rates.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('rateId') rateId: string,
    @Body(new ZodValidationPipe(rateStatusRequestSchema)) body: RateStatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, rateId, active: body.active });
  }
}
