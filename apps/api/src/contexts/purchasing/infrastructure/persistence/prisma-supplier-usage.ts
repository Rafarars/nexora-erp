import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierUsage } from '../../domain/supplier/usage/supplier-usage.js';

@Injectable()
export class PrismaSupplierUsage implements SupplierUsage {
  constructor(private readonly prisma: PrismaService) {}

  // Confirmadas y a medias: un borrador todavia no prometio nada.
  async hasOpenOrders(tenantId: TenantId, supplierId: SupplierId): Promise<boolean> {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: {
        tenantId: tenantId.value,
        supplierId: supplierId.value,
        status: { in: ['confirmed', 'partially_received'] },
      },
      select: { id: true },
    });

    return row !== null;
  }
}
