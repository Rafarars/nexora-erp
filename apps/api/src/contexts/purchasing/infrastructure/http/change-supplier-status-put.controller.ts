import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { SupplierStatusChanger } from '../../application/change-supplier-status/supplier-status-changer.js';
import { statusRequestSchema } from './dto/supplier.request.dto.js';
import type { StatusRequestDto } from './dto/supplier.request.dto.js';

@Controller('api/v1/purchasing/suppliers')
export class ChangeSupplierStatusPutController {
  constructor(private readonly changer: SupplierStatusChanger) {}

  @Put(':supplierId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchasing.suppliers.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('supplierId') supplierId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, supplierId, active: body.active });
  }
}
