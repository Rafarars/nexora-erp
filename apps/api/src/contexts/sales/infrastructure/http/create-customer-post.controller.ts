import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { CustomerCreator } from '../../application/create-customer/customer-creator.js';
import { customerRequestSchema } from './dto/customer.request.dto.js';
import type { CustomerRequestDto } from './dto/customer.request.dto.js';

@Controller('api/v1/sales/customers')
export class CreateCustomerPostController {
  constructor(private readonly creator: CustomerCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales.customers.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(customerRequestSchema)) body: CustomerRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
