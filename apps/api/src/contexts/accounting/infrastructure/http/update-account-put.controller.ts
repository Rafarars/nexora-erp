import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { UpdateAccountUseCase } from '../../application/update-account/update-account.use-case.js';
import { updateAccountRequestSchema } from './dto/account.request.dto.js';
import type { UpdateAccountRequestDto } from './dto/account.request.dto.js';

@Controller('api/v1/accounting/accounts')
export class UpdateAccountPutController {
  constructor(private readonly useCase: UpdateAccountUseCase) {}

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounting.accounts.update')
  async run(
    @Session() session: CurrentSession,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAccountRequestSchema)) body: UpdateAccountRequestDto,
  ): Promise<void> {
    await this.useCase.execute({
      ...body,
      id,
      tenantId: session.tenantId,
    });
  }
}
