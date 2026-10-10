import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AccountingCodeSequence } from '../../domain/journal/accounting-code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaAccountingCodeSequence implements AccountingCodeSequence {
  constructor(private readonly prisma: PrismaService) {}

  async next(tenantId: TenantId): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ last_value: number }[]>`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId.value}::uuid, 'AST', 1)
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = code_sequences.last_value + 1
      RETURNING last_value`;

    return Number(row.last_value);
  }
}
