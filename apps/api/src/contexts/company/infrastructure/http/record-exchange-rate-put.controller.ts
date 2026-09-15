import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ExchangeRateRecorder } from '../../application/record-exchange-rate/exchange-rate-recorder.js';
import { exchangeRateRequestSchema } from './dto/company.request.dto.js';
import type { ExchangeRateRequestDto } from './dto/company.request.dto.js';

@Controller('api/v1/company')
export class RecordExchangeRatePutController {
  constructor(private readonly recorder: ExchangeRateRecorder) {}

  // PUT y no POST: la moneda, la fecha y el tipo identifican la tasa, y repetir la carga corrige.
  @Put('exchange-rates')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('company.rates.record')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(exchangeRateRequestSchema)) body: ExchangeRateRequestDto,
  ): Promise<{ id: string }> {
    return this.recorder.run({ ...body, tenantId: session.tenantId });
  }
}
