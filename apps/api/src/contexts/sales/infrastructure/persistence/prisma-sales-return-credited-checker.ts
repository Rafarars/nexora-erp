import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesReturnCreditedChecker } from '../../domain/return/credited/sales-return-credited-checker.js';
import { SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaSalesReturnCreditedChecker implements SalesReturnCreditedChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isCredited(tenantId: TenantId, returnId: SalesReturnId): Promise<boolean> {
    const confirmedCreditNote = await this.prisma.customerCreditNote.findFirst({
      where: {
        tenantId: tenantId.value,
        salesReturnId: returnId.value,
        status: 'confirmed',
      },
      select: { id: true },
    });


    return confirmedCreditNote !== null;
  }
}
