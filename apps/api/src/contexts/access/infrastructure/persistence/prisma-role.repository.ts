import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { RoleName } from '../../domain/role/role-name.vo.js';
import { Role } from '../../domain/role/role.entity.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';

type RoleRow = {
  id: string;
  tenantId: string;
  name: string;
  grantsAll: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permissionCode: string }[];
};

function toDomain(row: RoleRow): Role {
  return Role.fromPrimitives({
    ...row,
    permissions: row.permissions.map((granted) => granted.permissionCode),
  });
}

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(role: Role): Promise<void> {
    const { id, tenantId, name, grantsAll, permissions } = role.toPrimitives();

    await this.prisma.$transaction([
      this.prisma.role.upsert({
        where: { id },
        create: { id, tenantId, name, grantsAll },
        update: { name, grantsAll },
      }),
      this.prisma.rolePermission.deleteMany({
        where: { roleId: id, permissionCode: { notIn: permissions } },
      }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((permissionCode) => ({ roleId: id, permissionCode })),
        skipDuplicates: true,
      }),
    ]);
  }

  async find(tenantId: TenantId, id: RoleId): Promise<Role | null> {
    const row = await this.prisma.role.findFirst({
      where: { id: id.value, tenantId: tenantId.value },
      include: { permissions: true },
    });

    return row ? toDomain(row) : null;
  }

  async findByName(tenantId: TenantId, name: RoleName): Promise<Role | null> {
    const row = await this.prisma.role.findFirst({
      where: { tenantId: tenantId.value, name: name.value },
      include: { permissions: true },
    });

    return row ? toDomain(row) : null;
  }

  async searchByIds(tenantId: TenantId, ids: RoleId[]): Promise<Role[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.role.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });

    return rows.map(toDomain);
  }

  async searchByTenant(tenantId: TenantId): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({
      where: { tenantId: tenantId.value },
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });

    return rows.map(toDomain);
  }
}
