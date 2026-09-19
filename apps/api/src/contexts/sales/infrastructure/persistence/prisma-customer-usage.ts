import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerUsage } from '../../domain/customer/usage/customer-usage.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaCustomerUsage implements CustomerUsage {
  constructor(private readonly prisma: PrismaService) {}

  // Confirmados y a medias: un borrador todavia no prometio nada.
  async hasOpenOrders(tenantId: TenantId, customerId: CustomerId): Promise<boolean> {
    const row = await this.prisma.salesOrder.findFirst({
      where: {
        tenantId: tenantId.value,
        customerId: customerId.value,
        status: { in: ['confirmed', 'partially_dispatched'] },
      },
      select: { id: true },
    });

    return row !== null;
  }
}
