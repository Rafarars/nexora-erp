import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CreateAccountUseCase } from '../../application/create-account/create-account.use-case.js';
import type { AccountType } from '../../domain/account/account-type.vo.js';
import { createAccountRequestSchema } from './dto/account.request.dto.js';
import type { CreateAccountRequestDto } from './dto/account.request.dto.js';

@Controller('api/v1/accounting/accounts')
export class CreateAccountPostController {
  constructor(private readonly useCase: CreateAccountUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('accounting.accounts.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(createAccountRequestSchema)) body: CreateAccountRequestDto,
  ): Promise<{ id: string }> {
    return this.useCase.execute({
      ...body,
      type: body.type as AccountType,
      tenantId: session.tenantId,
    });
  }
}
