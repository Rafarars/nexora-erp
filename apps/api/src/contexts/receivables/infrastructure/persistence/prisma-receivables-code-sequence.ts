import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ReceivablesCodePrefix, ReceivablesCodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// La misma tabla de contadores que los demas contextos, con su prefijo.
@Injectable()
export class PrismaReceivablesCodeSequence implements ReceivablesCodeSequence {
  constructor(private readonly prisma: PrismaService) {}

  async next(tenantId: TenantId, prefix: ReceivablesCodePrefix): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ last_value: number }[]>`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId.value}::uuid, ${prefix}, 1)
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = code_sequences.last_value + 1
      RETURNING last_value`;

    return Number(row.last_value);
  }
}
