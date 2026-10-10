import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { UpdateAccountUseCase } from '../../application/update-account/update-account.use-case.js';

const changeAccountStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();

type ChangeAccountStatusDto = z.infer<typeof changeAccountStatusSchema>;

@Controller('api/v1/accounting/accounts')
export class ChangeAccountStatusPutController {
  constructor(private readonly useCase: UpdateAccountUseCase) {}

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounting.accounts.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeAccountStatusSchema)) body: ChangeAccountStatusDto,
  ): Promise<void> {
    await this.useCase.execute({
      tenantId: session.tenantId,
      id,
      isActive: body.isActive,
    });
  }
}
