import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantNames } from '../../domain/profile/tenant-names.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Lee la tabla de empresas de access sin importar ese contexto.
@Injectable()
export class PrismaTenantNames implements TenantNames {
  constructor(private readonly prisma: PrismaService) {}

  async nameOf(tenantId: TenantId): Promise<string> {
    return (await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId.value }, select: { name: true } })).name;
  }
}
