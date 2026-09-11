import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { MembershipId } from '../../domain/membership/membership-id.vo.js';
import { Membership } from '../../domain/membership/membership.entity.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';

type MembershipRow = {
  id: string;
  userId: string;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: { roleId: string }[];
};

function toDomain(row: MembershipRow): Membership {
  return Membership.fromPrimitives({
    ...row,
    roleIds: row.roles.map((assigned) => assigned.roleId),
  });
}

@Injectable()
export class PrismaMembershipRepository implements MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(membership: Membership): Promise<void> {
    const { id, userId, tenantId, isActive, roleIds } = membership.toPrimitives();

    // Los roles son una tabla intermedia: se reemplaza el conjunto entero en una
    // transaccion para que nadie pueda leer la membresia sin roles a medio camino.
    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: { id },
        create: { id, userId, tenantId, isActive },
        update: { isActive },
      }),
      this.prisma.membershipRole.deleteMany({
        where: { membershipId: id, roleId: { notIn: roleIds } },
      }),
      this.prisma.membershipRole.createMany({
        data: roleIds.map((roleId) => ({ membershipId: id, roleId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async find(tenantId: TenantId, id: MembershipId): Promise<Membership | null> {
    const row = await this.prisma.membership.findFirst({
      where: { id: id.value, tenantId: tenantId.value },
      include: { roles: true },
    });

    return row ? toDomain(row) : null;
  }

  async findByUser(tenantId: TenantId, userId: UserId): Promise<Membership | null> {
    const row = await this.prisma.membership.findFirst({
      where: { tenantId: tenantId.value, userId: userId.value },
      include: { roles: true },
    });

    return row ? toDomain(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Membership[]> {
    const rows = await this.prisma.membership.findMany({
      where: { tenantId: tenantId.value },
      include: { roles: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toDomain);
  }

  async searchByUser(userId: UserId): Promise<Membership[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId: userId.value },
      include: { roles: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toDomain);
  }
}
