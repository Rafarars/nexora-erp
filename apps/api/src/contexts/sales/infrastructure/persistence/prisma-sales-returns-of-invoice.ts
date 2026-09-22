import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesOrderLineId } from '../../domain/order/sales-order-line.js';
import { SalesReturnsOfInvoice } from '../../domain/invoice/returns/sales-returns-of-invoice.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaSalesReturnsOfInvoice implements SalesReturnsOfInvoice {
  constructor(private readonly prisma: PrismaService) {}

  async countConfirmedReturnsOf(tenantId: TenantId, orderLineIds: SalesOrderLineId[]): Promise<number> {
    if (orderLineIds.length === 0) return 0;

    return this.prisma.salesReturnLine.count({
      where: {
        tenantId: tenantId.value,
        salesReturn: {
          tenantId: tenantId.value,
          status: 'confirmed',
        },
        dispatchLine: {
          tenantId: tenantId.value,
          orderLineId: { in: orderLineIds.map((id) => id.value) },
        },
      },
    });
  }
}
