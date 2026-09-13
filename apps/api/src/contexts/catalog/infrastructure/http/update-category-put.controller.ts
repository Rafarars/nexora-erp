import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CategoryUpdater } from '../../application/update-category/category-updater.js';
import { categoryRequestSchema } from './dto/category.request.dto.js';
import type { CategoryRequestDto } from './dto/category.request.dto.js';

@Controller('api/v1/catalog/categories')
export class UpdateCategoryPutController {
  constructor(private readonly updater: CategoryUpdater) {}

  @Put(':categoryId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.categories.update')
  async run(
    @Session() session: CurrentSession,
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(categoryRequestSchema)) body: CategoryRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, categoryId, tenantId: session.tenantId });
  }
}
