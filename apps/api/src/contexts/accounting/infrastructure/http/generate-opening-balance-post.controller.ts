import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { GenerateOpeningBalanceUseCase } from '../../application/generate-opening-balance/generate-opening-balance.use-case.js';
import type { GenerateOpeningBalanceResult } from '../../application/generate-opening-balance/generate-opening-balance.use-case.js';
import {
  generateOpeningBalanceRequestSchema,
  type GenerateOpeningBalanceRequestDto,
} from './dto/opening-balance.request.dto.js';

@Controller('api/v1/accounting/opening-balance')
export class GenerateOpeningBalancePostController {
  constructor(private readonly useCase: GenerateOpeningBalanceUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('accounting.accounts.update')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(generateOpeningBalanceRequestSchema)) body: GenerateOpeningBalanceRequestDto,
  ): Promise<GenerateOpeningBalanceResult> {
    return this.useCase.execute({
      tenantId: session.tenantId,
      date: body.date,
    });
  }
}
