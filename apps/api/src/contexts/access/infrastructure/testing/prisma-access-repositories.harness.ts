import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import type { Env } from '../../../../shared/config/env.schema.js';
import { ACCESS_PERMISSIONS } from '../../domain/role/permissions.catalog.js';
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
    await this.prisma.membershipRole.deleteMany();
    await this.prisma.rolePermission.deleteMany();
    await this.prisma.membership.deleteMany();
    await this.prisma.role.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.tenant.deleteMany();

    // El catalogo NO se borra: es lo que `make migrate` deja puesto, y el contrato
    // debe correr contra los permisos de verdad, no contra unos inventados.
    await this.prisma.permission.createMany({
      data: ACCESS_PERMISSIONS,
      skipDuplicates: true,
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
