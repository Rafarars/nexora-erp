import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { assertDisposableDatabase } from './disposable-database.js';

// Datos de demostracion para desarrollo y para la suite end-to-end. DOS empresas, no
// una: sin una segunda empresa no se puede probar que el aislamiento funciona, que es
// lo que este sistema tiene que demostrar.
//
// Y una tercera, Initech, que ninguna prueba lee salvo la que la usa: es para lo que
// solo existe una vez por empresa, como la bodega por defecto. Las pruebas corren en
// paralelo, y moverla en Acme haria fallar a otra que en ese instante comprueba cual es.
//
// Las contrasenas son conocidas a proposito, y por eso se niega a correr en
// produccion. Es idempotente: `make seed` dos veces deja el mismo resultado.
const ACME = '11111111-1111-4111-8111-111111111111';
const GLOBEX = '22222222-2222-4222-8222-222222222222';
const INITECH = '33333333-3333-4333-8333-333333333333';

const ACME_ADMIN_ROLE = 'a0000000-0000-4000-8000-000000000001';
const ACME_VIEWER_ROLE = 'a0000000-0000-4000-8000-000000000002';
const GLOBEX_ADMIN_ROLE = 'b0000000-0000-4000-8000-000000000001';
const INITECH_ADMIN_ROLE = 'f0000000-0000-4000-8000-000000000001';

const ANA = 'c0000000-0000-4000-8000-000000000001';
const BETO = 'c0000000-0000-4000-8000-000000000002';
const CONTADOR = 'c0000000-0000-4000-8000-000000000003';
const SUPERUSER = 'c0000000-0000-4000-8000-000000000004';
const DORA = 'c0000000-0000-4000-8000-000000000005';

const PASSWORD = process.env.SEED_PASSWORD ?? 'Nexora-2026!';

// Catalogo de ejemplo. Identificadores fijos por la misma razon que los de arriba: las
// pruebas de aislamiento atacan la categoria, la unidad o la bodega de Globex por su
// identificador, y tienen que saber cual es.
const CATALOG = {
  acme: {
    units: {
      piece: 'e0000000-0000-4000-8000-000000000001',
      box: 'e0000000-0000-4000-8000-000000000002',
      kilo: 'e0000000-0000-4000-8000-000000000003',
    },
    categories: { drinks: 'e1000000-0000-4000-8000-000000000001', cleaning: 'e1000000-0000-4000-8000-000000000002' },
    taxes: { vat: 'e2000000-0000-4000-8000-000000000001', exempt: 'e2000000-0000-4000-8000-000000000002' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000001', north: 'e3000000-0000-4000-8000-000000000002' },
    items: {
      water: 'e4000000-0000-4000-8000-000000000001',
      detergent: 'e4000000-0000-4000-8000-000000000002',
      delivery: 'e4000000-0000-4000-8000-000000000003',
    },
  },
  globex: {
    units: {
      piece: 'e0000000-0000-4000-8000-000000000101',
      box: 'e0000000-0000-4000-8000-000000000102',
      kilo: 'e0000000-0000-4000-8000-000000000103',
    },
    categories: { parts: 'e1000000-0000-4000-8000-000000000101' },
    taxes: { vat: 'e2000000-0000-4000-8000-000000000101' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000101' },
    items: { filter: 'e4000000-0000-4000-8000-000000000101' },
  },
  initech: {
    units: { piece: 'e0000000-0000-4000-8000-000000000201' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000201', second: 'e3000000-0000-4000-8000-000000000202' },
  },
};

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must never run in production: its passwords are public.');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed.');
  }

  assertDisposableDatabase(connectionString);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const passwordHash = await hash(PASSWORD);

  try {
    await removeLeftovers(prisma);
    await upsertTenants(prisma);
    await upsertRoles(prisma);
    await upsertUsers(prisma, passwordHash);
    await upsertMemberships(prisma);
    await seedCatalog(prisma);

    console.log(
      '  semillas aplicadas: 3 empresas, 4 roles, 5 personas, 7 membresias; ' +
        'catalogo: 7 unidades, 3 categorias, 3 impuestos, 5 bodegas, 4 articulos',
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Las pruebas end-to-end crean personas y roles sobre la marcha. Sin esto la base
// acumula basura de corridas anteriores y las capturas del reporte salen con
// veinte filas llamadas `colado-1789144380150@acme.com`.
async function removeLeftovers(prisma: PrismaClient): Promise<void> {
  const seeded = [ANA, BETO, CONTADOR, SUPERUSER, DORA];
  const seededRoles = [ACME_ADMIN_ROLE, ACME_VIEWER_ROLE, GLOBEX_ADMIN_ROLE, INITECH_ADMIN_ROLE];

  await prisma.membership.deleteMany({ where: { userId: { notIn: seeded } } });
  await prisma.user.deleteMany({ where: { id: { notIn: seeded } } });
  await prisma.role.deleteMany({ where: { id: { notIn: seededRoles } } });
}

async function upsertTenants(prisma: PrismaClient): Promise<void> {
  const tenants = [
    { id: ACME, name: 'Acme Industrial', slug: 'acme' },
    { id: GLOBEX, name: 'Globex Servicios', slug: 'globex' },
    { id: INITECH, name: 'Initech Logística', slug: 'initech' },
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
      // Solo lectura tambien en el catalogo: es el rol con el que las pruebas comprueban
      // que ver no es lo mismo que poder editar.
      permissions: [
        'access.users.search',
        'catalog.items.search',
        'catalog.categories.search',
        'catalog.units.search',
        'catalog.taxes.search',
        'catalog.warehouses.search',
      ],
    },
    { id: GLOBEX_ADMIN_ROLE, tenantId: GLOBEX, name: 'Administrador', grantsAll: true, permissions: [] },
    { id: INITECH_ADMIN_ROLE, tenantId: INITECH, name: 'Administrador', grantsAll: true, permissions: [] },
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
    // Superusuario SIN atajos: no hay un `if (esSuperusuario)` en ningun sitio. Puede
    // todo porque es administrador en cada empresa, y el guardian lo trata igual que a
    // cualquiera. Una empresa nueva no le da acceso hasta que alguien lo invite.
    { id: SUPERUSER, email: 'admin@nexora.com', name: 'Superusuario' },
    // Solo en Initech: nadie mas entra ahi, asi que lo que ella mueve no pisa otra prueba.
    { id: DORA, email: 'dora@initech.com', name: 'Dora Paz' },
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
    { id: 'd0000000-0000-4000-8000-000000000005', userId: SUPERUSER, tenantId: ACME, roles: [ACME_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000006', userId: SUPERUSER, tenantId: GLOBEX, roles: [GLOBEX_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000007', userId: DORA, tenantId: INITECH, roles: [INITECH_ADMIN_ROLE] },
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

async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const { acme, globex, initech } = CATALOG;

  const units = [
    { id: acme.units.piece, tenantId: ACME, code: 'UOM000001', name: 'Unidad', abbreviation: 'un' },
    { id: acme.units.box, tenantId: ACME, code: 'UOM000002', name: 'Caja', abbreviation: 'cja' },
    { id: acme.units.kilo, tenantId: ACME, code: 'UOM000003', name: 'Kilogramo', abbreviation: 'kg' },
    { id: globex.units.piece, tenantId: GLOBEX, code: 'UOM000001', name: 'Unidad', abbreviation: 'un' },
    { id: globex.units.box, tenantId: GLOBEX, code: 'UOM000002', name: 'Caja', abbreviation: 'cja' },
    { id: globex.units.kilo, tenantId: GLOBEX, code: 'UOM000003', name: 'Kilogramo', abbreviation: 'kg' },
    { id: initech.units.piece, tenantId: INITECH, code: 'UOM000001', name: 'Unidad', abbreviation: 'un' },
  ];
  const categories = [
    { id: acme.categories.drinks, tenantId: ACME, code: 'CAT000001', name: 'Bebidas', description: null },
    { id: acme.categories.cleaning, tenantId: ACME, code: 'CAT000002', name: 'Limpieza', description: null },
    { id: globex.categories.parts, tenantId: GLOBEX, code: 'CAT000001', name: 'Repuestos', description: null },
  ];
  const taxes = [
    { id: acme.taxes.vat, tenantId: ACME, code: 'IMP000001', name: 'IVA 16%', rate: 16 },
    { id: acme.taxes.exempt, tenantId: ACME, code: 'IMP000002', name: 'Exento', rate: 0 },
    { id: globex.taxes.vat, tenantId: GLOBEX, code: 'IMP000001', name: 'IVA 16%', rate: 16 },
  ];
  // Las que no son por defecto van primero, igual que en el repositorio: si una prueba
  // dejo marcada otra, se le quita antes de devolversela a la suya.
  const warehouses = [
    { id: initech.warehouses.second, tenantId: INITECH, code: 'BOD000002', name: 'Secundaria', address: null, isDefault: false },
    { id: acme.warehouses.north, tenantId: ACME, code: 'BOD000002', name: 'Norte', address: null, isDefault: false },
    { id: acme.warehouses.main, tenantId: ACME, code: 'BOD000001', name: 'Principal', address: 'Zona Industrial, galpón 4', isDefault: true },
    { id: globex.warehouses.main, tenantId: GLOBEX, code: 'BOD000001', name: 'Central', address: null, isDefault: true },
    { id: initech.warehouses.main, tenantId: INITECH, code: 'BOD000001', name: 'Principal', address: null, isDefault: true },
  ];
  const items = [
    {
      id: acme.items.water, tenantId: ACME, code: 'ART000001', sku: 'AGUA-500', name: 'Agua mineral 500 ml',
      description: null, type: 'inventoried' as const, categoryId: acme.categories.drinks, taxId: acme.taxes.vat,
      units: [
        { unitId: acme.units.piece, conversionFactor: 1, isBase: true },
        { unitId: acme.units.box, conversionFactor: 24, isBase: false },
      ],
    },
    {
      id: acme.items.detergent, tenantId: ACME, code: 'ART000002', sku: 'DETERGENTE-1KG', name: 'Detergente en polvo 1 kg',
      description: null, type: 'inventoried' as const, categoryId: acme.categories.cleaning, taxId: acme.taxes.vat,
      units: [{ unitId: acme.units.kilo, conversionFactor: 1, isBase: true }],
    },
    {
      id: acme.items.delivery, tenantId: ACME, code: 'ART000003', sku: 'SERV-ENTREGA', name: 'Servicio de entrega',
      description: 'Entrega a domicilio dentro de la ciudad', type: 'service' as const, categoryId: null,
      taxId: acme.taxes.exempt, units: [{ unitId: acme.units.piece, conversionFactor: 1, isBase: true }],
    },
    {
      id: globex.items.filter, tenantId: GLOBEX, code: 'ART000001', sku: 'FILTRO-ACEITE', name: 'Filtro de aceite',
      description: null, type: 'inventoried' as const, categoryId: globex.categories.parts, taxId: globex.taxes.vat,
      units: [{ unitId: globex.units.piece, conversionFactor: 1, isBase: true }],
    },
  ];

  await removeCatalogLeftovers(prisma, { units, categories, taxes, warehouses, items });

  for (const unit of units) {
    await prisma.measurementUnit.upsert({ where: { id: unit.id }, create: unit, update: { ...unit, isActive: true } });
  }
  for (const category of categories) {
    await prisma.category.upsert({ where: { id: category.id }, create: category, update: { ...category, isActive: true } });
  }
  for (const tax of taxes) {
    await prisma.tax.upsert({ where: { id: tax.id }, create: tax, update: { ...tax, isActive: true } });
  }
  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({ where: { id: warehouse.id }, create: warehouse, update: { ...warehouse, isActive: true } });
  }
  for (const { units: itemUnits, ...item } of items) {
    await prisma.item.upsert({ where: { id: item.id }, create: item, update: { ...item, isActive: true } });
    await prisma.itemUnit.deleteMany({ where: { itemId: item.id } });
    await prisma.itemUnit.createMany({
      data: itemUnits.map((unit) => ({ tenantId: item.tenantId, itemId: item.id, ...unit })),
    });
  }

  // El contador nunca retrocede: si las pruebas ya numeraron mas alla de lo sembrado, se
  // queda donde esta; si no existia, arranca despues del ultimo codigo sembrado.
  const rows = [...units, ...categories, ...taxes, ...warehouses, ...items];
  const highest = new Map<string, number>();

  for (const { tenantId, code } of rows) {
    const key = `${tenantId}|${code.slice(0, 3)}`;
    highest.set(key, Math.max(highest.get(key) ?? 0, Number(code.slice(3))));
  }

  for (const [key, lastValue] of highest) {
    const [tenantId, prefix] = key.split('|');

    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Lo que las pruebas crean sobre la marcha se borra aqui, igual que las personas: la
// politica de no borrado es del sistema, no de una base de demostracion. Los articulos
// primero, porque las claves ajenas no dejan borrar lo que un articulo usa.
async function removeCatalogLeftovers(
  prisma: PrismaClient,
  seeded: { [table: string]: { id: string }[] },
): Promise<void> {
  const ids = (table: string) => seeded[table].map((row) => row.id);

  await prisma.item.deleteMany({ where: { id: { notIn: ids('items') } } });
  await prisma.category.deleteMany({ where: { id: { notIn: ids('categories') } } });
  await prisma.tax.deleteMany({ where: { id: { notIn: ids('taxes') } } });
  await prisma.measurementUnit.deleteMany({ where: { id: { notIn: ids('units') } } });
  await prisma.warehouse.deleteMany({ where: { id: { notIn: ids('warehouses') } } });
}

await main();
