import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CodePrefix } from '../../domain/shared/catalog-code.vo.js';
import { CodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaCodeSequence implements CodeSequence {
  constructor(private readonly prisma: PrismaService) {}

  // Una sola sentencia: crear la fila o incrementarla es atomico en PostgreSQL, asi
  // que dos altas simultaneas nunca leen el mismo valor. Leer y luego escribir si
  // podria repetirlo.
  async next(tenantId: TenantId, prefix: CodePrefix): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ last_value: number }[]>`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId.value}::uuid, ${prefix}, 1)
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = code_sequences.last_value + 1
      RETURNING last_value`;

    return Number(row.last_value);
  }
}
