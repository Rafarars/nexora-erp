import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CustomerUpdater } from '../../application/update-customer/customer-updater.js';
import { customerRequestSchema } from './dto/customer.request.dto.js';
import type { CustomerRequestDto } from './dto/customer.request.dto.js';

@Controller('api/v1/sales/customers')
export class UpdateCustomerPutController {
  constructor(private readonly updater: CustomerUpdater) {}

  @Put(':customerId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.customers.update')
  async run(
    @Session() session: CurrentSession,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(customerRequestSchema)) body: CustomerRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, customerId, tenantId: session.tenantId });
  }
}
