import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CategoryStatusChanger } from '../../application/change-category-status/category-status-changer.js';
import { statusRequestSchema } from './dto/status.request.dto.js';
import type { StatusRequestDto } from './dto/status.request.dto.js';

@Controller('api/v1/catalog/categories')
export class ChangeCategoryStatusPutController {
  constructor(private readonly changer: CategoryStatusChanger) {}

  @Put(':categoryId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.categories.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, categoryId, active: body.active });
  }
}
