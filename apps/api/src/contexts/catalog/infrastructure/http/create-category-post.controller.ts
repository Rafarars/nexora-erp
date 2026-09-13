import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CategoryCreator } from '../../application/create-category/category-creator.js';
import { categoryRequestSchema } from './dto/category.request.dto.js';
import type { CategoryRequestDto } from './dto/category.request.dto.js';

@Controller('api/v1/catalog/categories')
export class CreateCategoryPostController {
  constructor(private readonly creator: CategoryCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('catalog.categories.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(categoryRequestSchema)) body: CategoryRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
