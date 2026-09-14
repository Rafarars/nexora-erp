import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CustomerStatusChanger } from '../../application/change-customer-status/customer-status-changer.js';
import { statusRequestSchema } from './dto/customer.request.dto.js';
import type { StatusRequestDto } from './dto/customer.request.dto.js';

@Controller('api/v1/sales/customers')
export class ChangeCustomerStatusPutController {
  constructor(private readonly changer: CustomerStatusChanger) {}

  @Put(':customerId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.customers.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(statusRequestSchema)) body: StatusRequestDto,
  ): Promise<void> {
    await this.changer.run({ tenantId: session.tenantId, customerId, active: body.active });
  }
}
