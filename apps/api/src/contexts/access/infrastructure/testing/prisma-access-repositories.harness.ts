import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import type { Env } from '../../../../shared/config/env.schema.js';
import { SYSTEM_PERMISSIONS } from '../../domain/role/permissions.catalog.js';
import {
  AccessRepositories,
  AccessRepositoriesHarness,
} from '../../testing/access-repositories.harness.js';
import { PrismaMembershipRepository } from '../persistence/prisma-membership.repository.js';
import { PrismaRoleRepository } from '../persistence/prisma-role.repository.js';
import { PrismaTenantRepository } from '../persistence/prisma-tenant.repository.js';
import { PrismaUserRepository } from '../persistence/prisma-user.repository.js';

// Un error de configuracion rompe la ejecucion, no la degrada en silencio: sin URL
// las pruebas fallarian con datos de otra base sin que nadie se enterase.
function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');
  }

  return url;
}

export class PrismaAccessRepositoriesHarness implements AccessRepositoriesHarness {
  private readonly prisma = new PrismaService(
    new ConfigService<Env, true>({ DATABASE_URL: connectionString() }),
  );

  repositories(): AccessRepositories {
    return {
      tenants: new PrismaTenantRepository(this.prisma),
      users: new PrismaUserRepository(this.prisma),
      memberships: new PrismaMembershipRepository(this.prisma),
      roles: new PrismaRoleRepository(this.prisma),
    };
  }

  // Cada ejecucion garantiza su estado inicial en vez de confiar en como lo dejo la
  // anterior. El orden respeta las claves ajenas.
  async reset(): Promise<void> {
    // Borrar una empresa arrastra en cascada su catalogo e inventario, pero las claves que
    // los unen son RESTRICT y PostgreSQL las comprueba fila a fila: la cascada falla si una
    // unidad o un movimiento revertido sigue referenciado. Se vacian antes, en orden. Sin
    // esto el resultado dependia de que otro contrato hubiera corrido primero.
    await this.prisma.goodsReceipt.deleteMany();
    await this.prisma.purchaseOrder.deleteMany();
    await this.prisma.supplier.deleteMany();
    await this.prisma.inventoryMovement.updateMany({ data: { reversalOfId: null } });
    await this.prisma.inventoryMovement.deleteMany();
    await this.prisma.itemStock.deleteMany();
    await this.prisma.adjustment.deleteMany();
    await this.prisma.itemUnit.deleteMany();
    await this.prisma.item.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.tax.deleteMany();
    await this.prisma.measurementUnit.deleteMany();
    await this.prisma.warehouse.deleteMany();
    await this.prisma.membershipRole.deleteMany();
    await this.prisma.rolePermission.deleteMany();
    await this.prisma.membership.deleteMany();
    await this.prisma.role.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.tenant.deleteMany();

    // El catalogo NO se borra: es lo que `make migrate` deja puesto, y el contrato
    // debe correr contra los permisos de verdad, no contra unos inventados.
    await this.prisma.permission.createMany({
      data: SYSTEM_PERMISSIONS,
      skipDuplicates: true,
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
