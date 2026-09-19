import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantAdministration } from '../../domain/membership/administration/tenant-administration.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';

@Injectable()
export class PrismaTenantAdministration implements TenantAdministration {
  constructor(private readonly prisma: PrismaService) {}

  // Un cerrojo de PostgreSQL por empresa, que dura lo que dura la transaccion. No bloquea
  // ninguna tabla: solo hace que dos peticiones de la MISMA empresa se turnen.
  async whileNobodyElseChangesIt<T>(tenantId: TenantId, work: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId.value}))`;

      return work();
    });
  }

  async countAdministratorsExcept(tenantId: TenantId, userId: UserId): Promise<number> {
    // Las tres condiciones de SignInPolicy que dependen de la persona: cuenta desactivada
    // o membresia revocada no administran nada, aunque conserven el rol.
    return this.prisma.membership.count({
      where: {
        tenantId: tenantId.value,
        isActive: true,
        userId: { not: userId.value },
        user: { isActive: true },
        // El tenantId del ROL tambien, no solo el de la membresia: `membership_roles` no
        // impide unir una membresia de una empresa con un rol de otra, y sin este filtro
        // se contaria como administradora a quien lleva un rol ajeno. Contar de mas es la
        // direccion mala: dejaria quitarle el rol al ultimo administrador de verdad.
        roles: { some: { role: { grantsAll: true, tenantId: tenantId.value } } },
      },
    });
  }
}
