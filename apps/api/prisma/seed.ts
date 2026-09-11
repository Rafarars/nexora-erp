import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Datos de demostracion para desarrollo y para la suite end-to-end. DOS empresas, no
// una: sin una segunda empresa no se puede probar que el aislamiento funciona, que es
// lo que este sistema tiene que demostrar.
//
// Las contrasenas son conocidas a proposito, y por eso se niega a correr en
// produccion. Es idempotente: `make seed` dos veces deja el mismo resultado.
const ACME = '11111111-1111-4111-8111-111111111111';
const GLOBEX = '22222222-2222-4222-8222-222222222222';

const ACME_ADMIN_ROLE = 'a0000000-0000-4000-8000-000000000001';
const ACME_VIEWER_ROLE = 'a0000000-0000-4000-8000-000000000002';
const GLOBEX_ADMIN_ROLE = 'b0000000-0000-4000-8000-000000000001';

const ANA = 'c0000000-0000-4000-8000-000000000001';
const BETO = 'c0000000-0000-4000-8000-000000000002';
const CONTADOR = 'c0000000-0000-4000-8000-000000000003';

const PASSWORD = process.env.SEED_PASSWORD ?? 'Nexora-2026!';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must never run in production: its passwords are public.');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const passwordHash = await hash(PASSWORD);

  try {
    await upsertTenants(prisma);
    await upsertRoles(prisma);
    await upsertUsers(prisma, passwordHash);
    await upsertMemberships(prisma);

    console.log('  semillas aplicadas: 2 empresas, 3 roles, 3 personas, 4 membresias');
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertTenants(prisma: PrismaClient): Promise<void> {
  const tenants = [
    { id: ACME, name: 'Acme Industrial', slug: 'acme' },
    { id: GLOBEX, name: 'Globex Servicios', slug: 'globex' },
  ];

  for (const tenant of tenants) {
    await prisma.tenant.upsert({ where: { id: tenant.id }, create: tenant, update: tenant });
  }
}

async function upsertRoles(prisma: PrismaClient): Promise<void> {
  const roles = [
    { id: ACME_ADMIN_ROLE, tenantId: ACME, name: 'Administrador', grantsAll: true, permissions: [] },
    {
      id: ACME_VIEWER_ROLE,
      tenantId: ACME,
      name: 'Consulta',
      grantsAll: false,
      permissions: ['access.users.search'],
    },
    { id: GLOBEX_ADMIN_ROLE, tenantId: GLOBEX, name: 'Administrador', grantsAll: true, permissions: [] },
  ];

  for (const { permissions, ...role } of roles) {
    await prisma.role.upsert({ where: { id: role.id }, create: role, update: role });
    await prisma.rolePermission.createMany({
      data: permissions.map((permissionCode) => ({ roleId: role.id, permissionCode })),
      skipDuplicates: true,
    });
  }
}

async function upsertUsers(prisma: PrismaClient, passwordHash: string): Promise<void> {
  const users = [
    { id: ANA, email: 'ana@acme.com', name: 'Ana Rivas' },
    { id: BETO, email: 'beto@globex.com', name: 'Beto Lugo' },
    // El contador que trabaja para las dos empresas: UNA persona, un solo correo.
    // Es el caso que justifica que `users` no lleve tenantId.
    { id: CONTADOR, email: 'contador@externo.com', name: 'Carla Mena' },
  ];

  for (const user of users) {
    const row = { ...user, passwordHash };

    await prisma.user.upsert({ where: { id: user.id }, create: row, update: row });
  }
}

async function upsertMemberships(prisma: PrismaClient): Promise<void> {
  const memberships = [
    { id: 'd0000000-0000-4000-8000-000000000001', userId: ANA, tenantId: ACME, roles: [ACME_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000002', userId: BETO, tenantId: GLOBEX, roles: [GLOBEX_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000003', userId: CONTADOR, tenantId: ACME, roles: [ACME_VIEWER_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000004', userId: CONTADOR, tenantId: GLOBEX, roles: [GLOBEX_ADMIN_ROLE] },
  ];

  for (const { roles, ...membership } of memberships) {
    await prisma.membership.upsert({
      where: { id: membership.id },
      create: membership,
      update: { isActive: true },
    });
    await prisma.membershipRole.createMany({
      data: roles.map((roleId) => ({ membershipId: membership.id, roleId })),
      skipDuplicates: true,
    });
  }
}

await main();
