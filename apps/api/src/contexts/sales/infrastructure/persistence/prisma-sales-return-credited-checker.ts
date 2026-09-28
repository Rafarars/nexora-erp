import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesReturnCreditedChecker } from '../../domain/return/credited/sales-return-credited-checker.js';
import { SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaSalesReturnCreditedChecker implements SalesReturnCreditedChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isCredited(tenantId: TenantId, returnId: SalesReturnId, context?: unknown): Promise<boolean> {
    const client = (context as TransactionClient) ?? this.prisma;
    const confirmedCreditNote = await client.customerCreditNote.findFirst({
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
