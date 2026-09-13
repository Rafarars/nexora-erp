import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierCreator } from '../../application/create-supplier/supplier-creator.js';
import { supplierRequestSchema } from './dto/supplier.request.dto.js';
import type { SupplierRequestDto } from './dto/supplier.request.dto.js';

@Controller('api/v1/purchasing/suppliers')
export class CreateSupplierPostController {
  constructor(private readonly creator: SupplierCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing.suppliers.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(supplierRequestSchema)) body: SupplierRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
