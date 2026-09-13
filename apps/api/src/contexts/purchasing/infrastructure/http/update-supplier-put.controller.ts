import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierUpdater } from '../../application/update-supplier/supplier-updater.js';
import { supplierRequestSchema } from './dto/supplier.request.dto.js';
import type { SupplierRequestDto } from './dto/supplier.request.dto.js';

@Controller('api/v1/purchasing/suppliers')
export class UpdateSupplierPutController {
  constructor(private readonly updater: SupplierUpdater) {}

  @Put(':supplierId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.suppliers.update')
  async run(
    @Session() session: CurrentSession,
    @Param('supplierId') supplierId: string,
    @Body(new ZodValidationPipe(supplierRequestSchema)) body: SupplierRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, supplierId, tenantId: session.tenantId });
  }
}
