import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantAdministration } from '../../domain/membership/administration/tenant-administration.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';

@Injectable()
export class PrismaTenantAdministration implements TenantAdministration {
  constructor(private readonly prisma: PrismaService) {}

  async countAdministratorsExcept(tenantId: TenantId, userId: UserId): Promise<number> {
    // Las tres condiciones de SignInPolicy que dependen de la persona: cuenta desactivada
    // o membresia revocada no administran nada, aunque conserven el rol.
    return this.prisma.membership.count({
      where: {
        tenantId: tenantId.value,
        isActive: true,
        userId: { not: userId.value },
        user: { isActive: true },
        roles: { some: { role: { grantsAll: true } } },
      },
    });
  }
}
