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
const VOLUME = '44444444-4444-4444-8444-444444444444';
const VOLUME_ADMIN_ROLE = 'f0000000-0000-4000-8000-000000000002';

const ANA = 'c0000000-0000-4000-8000-000000000001';
const BETO = 'c0000000-0000-4000-8000-000000000002';
const CONTADOR = 'c0000000-0000-4000-8000-000000000003';
const SUPERUSER = 'c0000000-0000-4000-8000-000000000004';
const DORA = 'c0000000-0000-4000-8000-000000000005';
const VERA = 'c0000000-0000-4000-8000-000000000006';

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
    priceLists: { retail: 'e6000000-0000-4000-8000-000000000001', wholesale: 'e6000000-0000-4000-8000-000000000002' },
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
    priceLists: { retail: 'e6000000-0000-4000-8000-000000000101' },
    items: { filter: 'e4000000-0000-4000-8000-000000000101' },
  },
  initech: {
    units: { piece: 'e0000000-0000-4000-8000-000000000201' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000201', second: 'e3000000-0000-4000-8000-000000000202' },
  },
};

// Lo que cada linea copia del maestro: renombrar un articulo no cambia los documentos ya escritos.
const ITEM_LABELS: Record<string, { itemSku: string; itemName: string }> = {
  'e4000000-0000-4000-8000-000000000001': { itemSku: 'AGUA-500', itemName: 'Agua mineral 500 ml' },
  'e4000000-0000-4000-8000-000000000002': { itemSku: 'DETERGENTE-1KG', itemName: 'Detergente en polvo 1 kg' },
  'e4000000-0000-4000-8000-000000000003': { itemSku: 'SERV-ENTREGA', itemName: 'Servicio de entrega' },
  'e4000000-0000-4000-8000-000000000101': { itemSku: 'FILTRO-ACEITE', itemName: 'Filtro de aceite' },
};

const labelsOf = (itemId: string) => ITEM_LABELS[itemId] ?? { itemSku: 'SIN-SKU', itemName: 'Sin nombre' };


// Compras de ejemplo. Globex tiene una orden confirmada, un borrador y una entrada en
// borrador porque la matriz de aislamiento los ataca desde Acme por su identificador.
const PURCHASING = {
  acme: {
    andina: 'e8000000-0000-4000-8000-000000000001',
    valle: 'e8000000-0000-4000-8000-000000000002',
    partialOrder: 'e9000000-0000-4000-8000-000000000001',
    draftOrder: 'e9000000-0000-4000-8000-000000000002',
    partialWater: 'ea000000-0000-4000-8000-000000000001',
    partialDetergent: 'ea000000-0000-4000-8000-000000000002',
    draftWater: 'ea000000-0000-4000-8000-000000000003',
    receipt: 'eb000000-0000-4000-8000-000000000001',
    receiptWater: 'ec000000-0000-4000-8000-000000000001',
    receiptMovement: 'e7000000-0000-4000-8000-000000000003',
  },
  globex: {
    supplier: 'e8000000-0000-4000-8000-000000000101',
    confirmedOrder: 'e9000000-0000-4000-8000-000000000101',
    draftOrder: 'e9000000-0000-4000-8000-000000000102',
    confirmedFilter: 'ea000000-0000-4000-8000-000000000101',
    draftFilter: 'ea000000-0000-4000-8000-000000000102',
    draftReceipt: 'eb000000-0000-4000-8000-000000000101',
    draftReceiptFilter: 'ec000000-0000-4000-8000-000000000101',
  },
};

// Ventas de ejemplo. Globex tiene un pedido despachado en parte con su despacho y factura, un
// despacho en borrador y un pedido en borrador: la matriz de aislamiento los ataca desde Acme.
const SALES = {
  acme: {
    delta: 'ed000000-0000-4000-8000-000000000001',
    corner: 'ed000000-0000-4000-8000-000000000002',
    partialOrder: 'ee000000-0000-4000-8000-000000000001',
    draftOrder: 'ee000000-0000-4000-8000-000000000002',
    partialWater: 'ef000000-0000-4000-8000-000000000001',
    partialDetergent: 'ef000000-0000-4000-8000-000000000002',
    draftWater: 'ef000000-0000-4000-8000-000000000003',
    dispatch: 'f1000000-0000-4000-8000-000000000001',
    dispatchWater: 'f2000000-0000-4000-8000-000000000001',
    invoice: 'f3000000-0000-4000-8000-000000000001',
    invoiceWater: 'f4000000-0000-4000-8000-000000000001',
    dispatchMovement: 'e7000000-0000-4000-8000-000000000004',
    payment: 'd3000000-0000-4000-8000-000000000001',
    paymentAllocation: 'd4000000-0000-4000-8000-000000000001',
  },
  globex: {
    customer: 'ed000000-0000-4000-8000-000000000101',
    partialOrder: 'ee000000-0000-4000-8000-000000000101',
    draftOrder: 'ee000000-0000-4000-8000-000000000102',
    partialFilter: 'ef000000-0000-4000-8000-000000000101',
    draftFilter: 'ef000000-0000-4000-8000-000000000102',
    dispatch: 'f1000000-0000-4000-8000-000000000101',
    dispatchFilter: 'f2000000-0000-4000-8000-000000000101',
    draftDispatch: 'f1000000-0000-4000-8000-000000000102',
    draftDispatchFilter: 'f2000000-0000-4000-8000-000000000102',
    invoice: 'f3000000-0000-4000-8000-000000000101',
    invoiceFilter: 'f4000000-0000-4000-8000-000000000101',
    dispatchMovement: 'e7000000-0000-4000-8000-000000000102',
    confirmedPayment: 'd3000000-0000-4000-8000-000000000101',
    draftPayment: 'd3000000-0000-4000-8000-000000000102',
    confirmedAllocation: 'd4000000-0000-4000-8000-000000000101',
    draftAllocation: 'd4000000-0000-4000-8000-000000000102',
  },
};

const INVENTORY = {
  acme: {
    opening: 'e5000000-0000-4000-8000-000000000001',
    breakage: 'e5000000-0000-4000-8000-000000000002',
    openingWater: 'e6000000-0000-4000-8000-000000000001',
    openingDetergent: 'e6000000-0000-4000-8000-000000000002',
    breakageWater: 'e6000000-0000-4000-8000-000000000003',
    waterMovement: 'e7000000-0000-4000-8000-000000000001',
    detergentMovement: 'e7000000-0000-4000-8000-000000000002',
  },
  globex: {
    opening: 'e5000000-0000-4000-8000-000000000101',
    draft: 'e5000000-0000-4000-8000-000000000102',
    openingFilter: 'e6000000-0000-4000-8000-000000000101',
    draftFilter: 'e6000000-0000-4000-8000-000000000102',
    filterMovement: 'e7000000-0000-4000-8000-000000000101',
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
    await upsertCompanies(prisma);
    await upsertExchangeRates(prisma);
    await upsertRoles(prisma);
    await upsertUsers(prisma, passwordHash);
    await upsertMemberships(prisma);
    // El inventario apunta al catalogo: se vacia antes de limpiar el catalogo y se siembra
    // despues de sembrarlo.
    await removeInventory(prisma);
    await seedCatalog(prisma);
    await seedInventory(prisma);
    await seedPurchasing(prisma);
    await seedSales(prisma);
    await seedReceivables(prisma);
    await seedVolume(prisma);

    console.log(
      '  semillas aplicadas: 4 empresas con sus datos y parametros, 5 roles, 6 personas, 8 membresias; ' +
        'catalogo: 7 unidades, 3 categorias, 3 impuestos, 5 bodegas, 3 listas de precio, 4 articulos con 6 precios; ' +
        'inventario: 4 ajustes (2 confirmados), 3 existencias; ' +
        'compras: 3 proveedores, 4 ordenes, 2 entradas; ' +
        'ventas: 3 clientes, 4 pedidos, 3 despachos, 2 facturas; ' +
        'cuentas por cobrar: 3 cobros (2 confirmados); ' +
        'volumen: 50 clientes, 5000 facturas, 3000 cobros',
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Las pruebas end-to-end crean personas y roles sobre la marcha. Sin esto la base
// acumula basura de corridas anteriores y las capturas del reporte salen con
// veinte filas llamadas `colado-1789144380150@acme.com`.
async function removeLeftovers(prisma: PrismaClient): Promise<void> {
  const seeded = [ANA, BETO, CONTADOR, SUPERUSER, DORA, VERA];
  const seededRoles = [ACME_ADMIN_ROLE, ACME_VIEWER_ROLE, GLOBEX_ADMIN_ROLE, INITECH_ADMIN_ROLE, VOLUME_ADMIN_ROLE];

  await prisma.membership.deleteMany({ where: { userId: { notIn: seeded } } });
  await prisma.user.deleteMany({ where: { id: { notIn: seeded } } });
  await prisma.role.deleteMany({ where: { id: { notIn: seededRoles } } });
}

async function upsertTenants(prisma: PrismaClient): Promise<void> {
  const tenants = [
    { id: ACME, name: 'Acme Industrial', slug: 'acme' },
    { id: GLOBEX, name: 'Globex Servicios', slug: 'globex' },
    { id: INITECH, name: 'Initech Logística', slug: 'initech' },
    { id: VOLUME, name: 'Volumen Distribuciones', slug: 'volumen' },
  ];

  for (const tenant of tenants) {
    await prisma.tenant.upsert({ where: { id: tenant.id }, create: tenant, update: tenant });
  }
}

// Los datos que cada empresa pone en sus documentos y sus parametros. Se reescriben en cada corrida:
// una prueba que los cambie no deja a la siguiente con otra moneda u otra zona horaria.
async function upsertCompanies(prisma: PrismaClient): Promise<void> {
  const profiles = [
    { tenantId: ACME, legalName: 'Acme Industrial, C.A.', tradeName: 'Acme', fiscalId: 'J-40000001-2', address: 'Av. Principal de Los Ruices, Caracas', phone: '0212-555-0101', email: 'administracion@acme.com' },
    { tenantId: GLOBEX, legalName: 'Globex Servicios, C.A.', tradeName: 'Globex', fiscalId: 'J-40000002-0', address: 'Av. Bolívar Norte, Valencia', phone: '0241-555-0102', email: 'administracion@globex.com' },
    { tenantId: INITECH, legalName: 'Initech Logística, C.A.', tradeName: null, fiscalId: 'J-40000003-9', address: null, phone: null, email: null },
    { tenantId: VOLUME, legalName: 'Volumen Distribuciones, C.A.', tradeName: null, fiscalId: 'J-40000004-7', address: null, phone: null, email: null },
  ];
  const settings = { baseCurrency: 'USD', secondaryCurrency: 'VES', timeZone: 'America/Caracas', amountDecimals: 2, priceDecimals: 6, rateType: 'legal' as const, allowsRateOverride: true };
  const updatedAt = new Date('2026-09-01T12:00:00.000Z');

  for (const profile of profiles) {
    const row = { ...profile, updatedAt };

    await prisma.companyProfile.upsert({ where: { tenantId: profile.tenantId }, create: row, update: row });
    await prisma.companySettings.upsert({
      where: { tenantId: profile.tenantId },
      create: { tenantId: profile.tenantId, ...settings, updatedAt },
      update: { ...settings, updatedAt },
    });
  }
}

// Unas tasas de septiembre para que la pantalla no nazca vacia: la legal del dolar y del euro, y una
// interna del dolar. La de Globex existe para que las pruebas de aislamiento tengan que atacar.
async function upsertExchangeRates(prisma: PrismaClient): Promise<void> {
  const rates = [
    { id: 'f6000000-0000-4000-8000-000000000001', tenantId: ACME, currency: 'USD', rateDate: '2026-09-01', type: 'legal', rate: '150.25', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000002', tenantId: ACME, currency: 'USD', rateDate: '2026-09-08', type: 'legal', rate: '152.40', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000003', tenantId: ACME, currency: 'USD', rateDate: '2026-09-11', type: 'legal', rate: '153.10', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000004', tenantId: ACME, currency: 'EUR', rateDate: '2026-09-01', type: 'legal', rate: '171.30', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000005', tenantId: ACME, currency: 'EUR', rateDate: '2026-09-11', type: 'legal', rate: '175.05', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000006', tenantId: ACME, currency: 'USD', rateDate: '2026-09-11', type: 'manual', rate: '160.00', source: 'Tasa interna de compras' },
    // Las de enero valoran cualquier documento de este ano, tambien los de las pruebas.
    { id: 'f6000000-0000-4000-8000-000000000007', tenantId: ACME, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000008', tenantId: ACME, currency: 'EUR', rateDate: '2026-01-01', type: 'legal', rate: '155.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000102', tenantId: GLOBEX, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '141.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000201', tenantId: INITECH, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000301', tenantId: VOLUME, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000101', tenantId: GLOBEX, currency: 'USD', rateDate: '2026-09-10', type: 'legal', rate: '152.80', source: 'BCV' },
  ] as const;
  const createdAt = new Date('2026-09-01T12:00:00.000Z');

  for (const { rateDate, ...rate } of rates) {
    const row = { ...rate, rateDate: new Date(`${rateDate}T00:00:00.000Z`), isActive: true, createdAt, updatedAt: createdAt };

    await prisma.exchangeRate.upsert({ where: { id: rate.id }, create: row, update: row });
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
      // Solo lectura tambien en el catalogo y el inventario: es el rol con el que las pruebas comprueban
      // que ver no es lo mismo que poder editar.
      permissions: [
        'access.users.search',
        'company.profile.search',
        'company.rates.search',
        'catalog.categories.search',
        'catalog.units.search',
        'catalog.taxes.search',
        'catalog.warehouses.search',
        'catalog.pricelists.search',
        'inventory.items.search',
        'inventory.adjustments.search',
        'inventory.stock.search',
        'inventory.movements.search',
        'purchasing.suppliers.search',
        'purchasing.orders.search',
        'purchasing.receipts.search',
        'purchasing.incoming.search',
        'sales.customers.search',
        'sales.orders.search',
        'sales.dispatches.search',
        'sales.invoices.search',
        'sales.availability.search',
        'receivables.payments.search',
        'receivables.balances.search',
        'receivables.statements.search',
        // Sin la valuacion del inventario: muestra costos.
        'reports.dashboard.search',
        'reports.receivables.search',
        'reports.sales.search',
      ],
    },
    { id: GLOBEX_ADMIN_ROLE, tenantId: GLOBEX, name: 'Administrador', grantsAll: true, permissions: [] },
    { id: INITECH_ADMIN_ROLE, tenantId: INITECH, name: 'Administrador', grantsAll: true, permissions: [] },
    { id: VOLUME_ADMIN_ROLE, tenantId: VOLUME, name: 'Administrador', grantsAll: true, permissions: [] },
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
    { id: VERA, email: 'vera@volumen.com', name: 'Vera Ruiz' },
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
    { id: 'd0000000-0000-4000-8000-000000000008', userId: VERA, tenantId: VOLUME, roles: [VOLUME_ADMIN_ROLE] },
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
    { id: acme.units.piece, tenantId: ACME, code: 'UOM000001', name: 'Unidad', abbreviation: 'un', mustBeWhole: true },
    { id: acme.units.box, tenantId: ACME, code: 'UOM000002', name: 'Caja', abbreviation: 'cja', mustBeWhole: true },
    { id: acme.units.kilo, tenantId: ACME, code: 'UOM000003', name: 'Kilogramo', abbreviation: 'kg' },
    { id: globex.units.piece, tenantId: GLOBEX, code: 'UOM000001', name: 'Unidad', abbreviation: 'un', mustBeWhole: true },
    { id: globex.units.box, tenantId: GLOBEX, code: 'UOM000002', name: 'Caja', abbreviation: 'cja', mustBeWhole: true },
    { id: globex.units.kilo, tenantId: GLOBEX, code: 'UOM000003', name: 'Kilogramo', abbreviation: 'kg' },
    { id: initech.units.piece, tenantId: INITECH, code: 'UOM000001', name: 'Unidad', abbreviation: 'un', mustBeWhole: true },
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
      id: acme.items.water, tenantId: ACME, code: 'ART000001', sku: 'AGUA-500', name: 'Agua mineral 500 ml', barcode: '7591234567890',
      description: null, type: 'inventoried' as const, categoryId: acme.categories.drinks, salesTaxId: acme.taxes.vat, purchaseTaxId: acme.taxes.vat,
      units: [
        { unitId: acme.units.piece, conversionFactor: 1, isBase: true },
        { unitId: acme.units.box, conversionFactor: 24, isBase: false },
      ],
    },
    {
      id: acme.items.detergent, tenantId: ACME, code: 'ART000002', sku: 'DETERGENTE-1KG', name: 'Detergente en polvo 1 kg', barcode: '7591234567891',
      description: null, type: 'inventoried' as const, categoryId: acme.categories.cleaning, salesTaxId: acme.taxes.vat, purchaseTaxId: acme.taxes.exempt,
      units: [{ unitId: acme.units.kilo, conversionFactor: 1, isBase: true }],
    },
    {
      id: acme.items.delivery, tenantId: ACME, code: 'ART000003', sku: 'SERV-ENTREGA', name: 'Servicio de entrega',
      description: 'Entrega a domicilio dentro de la ciudad', type: 'service' as const, categoryId: null, isPurchasable: false,
      salesTaxId: acme.taxes.exempt, purchaseTaxId: acme.taxes.exempt, units: [{ unitId: acme.units.piece, conversionFactor: 1, isBase: true }],
    },
    {
      id: globex.items.filter, tenantId: GLOBEX, code: 'ART000001', sku: 'FILTRO-ACEITE', name: 'Filtro de aceite',
      description: null, type: 'inventoried' as const, categoryId: globex.categories.parts, salesTaxId: globex.taxes.vat, purchaseTaxId: globex.taxes.vat,
      units: [{ unitId: globex.units.piece, conversionFactor: 1, isBase: true }],
    },
  ];

  // Acme cotiza en dolares: al detal y al mayor, con la del detal por defecto. El mayor rebaja el
  // agua y el detergente, que es lo que se ve en la pantalla del pedido.
  const priceLists = [
    { id: acme.priceLists.retail, tenantId: ACME, code: 'LPR000001', name: 'Detal', description: 'Precio de mostrador', currency: 'USD', isDefault: true },
    { id: acme.priceLists.wholesale, tenantId: ACME, code: 'LPR000002', name: 'Mayorista', description: 'Desde 10 unidades', currency: 'USD', isDefault: false },
    { id: globex.priceLists.retail, tenantId: GLOBEX, code: 'LPR000001', name: 'General', description: null, currency: 'USD', isDefault: true },
  ];

  await removeCatalogLeftovers(prisma, { units, categories, taxes, warehouses, priceLists, items });

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
  for (const priceList of priceLists) {
    await prisma.priceList.upsert({ where: { id: priceList.id }, create: priceList, update: { ...priceList, isActive: true } });
  }
  for (const { units: itemUnits, ...item } of items) {
    await prisma.item.upsert({ where: { id: item.id }, create: item, update: { ...item, isActive: true } });
    await prisma.itemUnit.deleteMany({ where: { itemId: item.id } });
    await prisma.itemUnit.createMany({
      data: itemUnits.map((unit) => ({ tenantId: item.tenantId, itemId: item.id, ...unit })),
    });
  }

  // Precios por lista, en la unidad base del articulo. El servicio de entrega tambien se cotiza.
  await prisma.itemPrice.deleteMany({ where: { tenantId: { in: [ACME, GLOBEX] } } });
  await prisma.itemPrice.createMany({
    data: [
      { tenantId: ACME, itemId: acme.items.water, priceListId: acme.priceLists.retail, price: 0.85 },
      { tenantId: ACME, itemId: acme.items.water, priceListId: acme.priceLists.wholesale, price: 0.7 },
      { tenantId: ACME, itemId: acme.items.detergent, priceListId: acme.priceLists.retail, price: 4.5 },
      { tenantId: ACME, itemId: acme.items.detergent, priceListId: acme.priceLists.wholesale, price: 3.9 },
      { tenantId: ACME, itemId: acme.items.delivery, priceListId: acme.priceLists.retail, price: 3 },
      { tenantId: GLOBEX, itemId: globex.items.filter, priceListId: globex.priceLists.retail, price: 12 },
    ],
  });

  // Reglas de reposicion, contra la existencia PROYECTADA. El agua ensena por que: hay 288 y el
  // minimo es 300, pero una orden trae 144 y un pedido reserva 72, asi que proyecta 360 y no hay
  // que pedir nada. El detergente si falta: 50 menos 10 vendidos mas 20 en camino son 60, bajo 80.
  await prisma.itemReorderRule.deleteMany({ where: { tenantId: { in: [ACME, GLOBEX] } } });
  await prisma.itemReorderRule.createMany({
    data: [
      { tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, minQuantity: 300, maxQuantity: 960, reorderQuantity: 480 },
      { tenantId: ACME, itemId: acme.items.detergent, warehouseId: acme.warehouses.main, minQuantity: 80, maxQuantity: null, reorderQuantity: 0 },
      { tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, minQuantity: 10, maxQuantity: null, reorderQuantity: 20 },
    ],
  });


  // El contador nunca retrocede: si las pruebas ya numeraron mas alla de lo sembrado, se
  // queda donde esta; si no existia, arranca despues del ultimo codigo sembrado.
  const rows = [...units, ...categories, ...taxes, ...warehouses, ...priceLists, ...items];
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
  await prisma.priceList.deleteMany({ where: { id: { notIn: ids('priceLists') } } });
  await prisma.category.deleteMany({ where: { id: { notIn: ids('categories') } } });
  await prisma.tax.deleteMany({ where: { id: { notIn: ids('taxes') } } });
  await prisma.measurementUnit.deleteMany({ where: { id: { notIn: ids('units') } } });
  await prisma.warehouse.deleteMany({ where: { id: { notIn: ids('warehouses') } } });
}

// Compras e inventario de demostracion se rehacen enteros en cada corrida: las pruebas
// confirman y anulan documentos, y dejar sus existencias haria que el seed no fuera el mismo
// dos veces. Compras primero: sus documentos apuntan a articulos y bodegas.
async function removeInventory(prisma: PrismaClient): Promise<void> {
  await prisma.customerPayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.inventoryMovement.updateMany({ data: { reversalOfId: null } });
  await prisma.inventoryMovement.deleteMany();
  await prisma.itemStock.deleteMany();
  await prisma.adjustment.deleteMany();
}

// Dos ajustes confirmados, con sus movimientos y existencias escritos como los escribiria
// el sistema (una caja de 24 a 12 entra a 0,5 por unidad), y un borrador por empresa.
async function seedInventory(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const confirmedAt = new Date('2026-09-01T12:00:00.000Z');
  const date = new Date('2026-09-01T00:00:00.000Z');

  const adjustments = [
    {
      id: INVENTORY.acme.opening, tenantId: ACME, code: 'AJU000001', warehouseId: acme.warehouses.main, notes: 'Conteo inicial',
      type: 'physical_count' as const, status: 'confirmed' as const, confirmedAt, createdBy: ANA, confirmedBy: ANA,
      lines: [
        { id: INVENTORY.acme.openingWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 10, baseQuantity: 240, unitCost: 12 },
        { id: INVENTORY.acme.openingDetergent, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 50, baseQuantity: 50, unitCost: 3.2 },
      ],
    },
    {
      id: INVENTORY.acme.breakage, tenantId: ACME, code: 'AJU000002', warehouseId: acme.warehouses.main, notes: 'Merma por rotura',
      type: 'damage' as const, status: 'draft' as const, confirmedAt: null, createdBy: ANA, confirmedBy: null,
      lines: [{ id: INVENTORY.acme.breakageWater, itemId: acme.items.water, unitId: acme.units.piece, quantity: 6, baseQuantity: 6, unitCost: null }],
      direction: 'out' as const,
    },
    {
      id: INVENTORY.globex.opening, tenantId: GLOBEX, code: 'AJU000001', warehouseId: globex.warehouses.main, notes: 'Conteo inicial',
      type: 'physical_count' as const, status: 'confirmed' as const, confirmedAt, createdBy: BETO, confirmedBy: BETO,
      lines: [{ id: INVENTORY.globex.openingFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 30, baseQuantity: 30, unitCost: 8.5 }],
    },
    {
      id: INVENTORY.globex.draft, tenantId: GLOBEX, code: 'AJU000002', warehouseId: globex.warehouses.main, notes: 'Filtros dañados',
      type: 'damage' as const, status: 'draft' as const, confirmedAt: null, createdBy: BETO, confirmedBy: null,
      lines: [{ id: INVENTORY.globex.draftFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 2, baseQuantity: 2, unitCost: null }],
      direction: 'out' as const,
    },
  ];

  for (const { lines, direction = 'in', ...adjustment } of adjustments) {
    await prisma.adjustment.create({ data: { ...adjustment, adjustmentDate: date, createdAt: date, updatedAt: confirmedAt } });
    await prisma.adjustmentLine.createMany({
      data: lines.map((line, index) => ({
        ...line,
        ...labelsOf(line.itemId),
        tenantId: adjustment.tenantId,
        adjustmentId: adjustment.id,
        lineNumber: index + 1,
        direction,
      })),
    });
  }

  const stocks = [
    { tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, quantity: 240, cost: 0.5, movement: INVENTORY.acme.waterMovement, adjustmentId: INVENTORY.acme.opening, lineId: INVENTORY.acme.openingWater },
    { tenantId: ACME, itemId: acme.items.detergent, warehouseId: acme.warehouses.main, quantity: 50, cost: 3.2, movement: INVENTORY.acme.detergentMovement, adjustmentId: INVENTORY.acme.opening, lineId: INVENTORY.acme.openingDetergent },
    { tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, quantity: 30, cost: 8.5, movement: INVENTORY.globex.filterMovement, adjustmentId: INVENTORY.globex.opening, lineId: INVENTORY.globex.openingFilter },
  ];

  for (const stock of stocks) {
    await prisma.inventoryMovement.create({
      data: {
        id: stock.movement, tenantId: stock.tenantId, itemId: stock.itemId, warehouseId: stock.warehouseId, sequence: 1,
        direction: 'in', quantity: stock.quantity, unitCost: stock.cost, balanceQuantity: stock.quantity,
        balanceAverageCost: stock.cost, originType: 'adjustment', originId: stock.adjustmentId, originLineId: stock.lineId,
        originDate: date, occurredAt: confirmedAt,
      },
    });
    await prisma.itemStock.create({
      data: {
        tenantId: stock.tenantId, itemId: stock.itemId, warehouseId: stock.warehouseId, quantity: stock.quantity,
        averageCost: stock.cost, lastSequence: 1, updatedAt: confirmedAt,
      },
    });
  }

  for (const tenantId of [ACME, GLOBEX]) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, 'AJU', 2)
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Una orden de Acme recibida en parte, con su entrada confirmada escrita como la escribiria el
// sistema (4 cajas de 24 a 12 entran a 0,5 por unidad y el agua pasa de 240 a 336), y un
// borrador. En Globex, lo que ataca la matriz de aislamiento.
// En dolares, la moneda de la empresa, con la tasa legal del dia del documento.
const dollarsAt = (rate: number) => ({ currency: 'USD', exchangeRate: rate, baseCurrency: 'USD', baseExchangeRate: rate, manualExchangeRate: false });

async function seedPurchasing(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);
  // En dolares, con la tasa legal de su fecha: la del 1 de septiembre en Acme y la de enero en Globex.
  const dollars = (tenantId: string) => {
    const rate = tenantId === ACME ? 150.25 : 141;

    return { currency: 'USD', exchangeRate: rate, baseCurrency: 'USD', baseExchangeRate: rate, manualExchangeRate: false };
  };

  await prisma.supplier.createMany({
    data: [
      {
        id: PURCHASING.acme.andina, tenantId: ACME, code: 'PRV000001', name: 'Distribuidora Andina', fiscalId: 'J-30512345-6',
        email: 'compras@andina.com', phone: '+58 212 555 0101', address: 'Av. Principal de Los Ruices', paymentTermDays: 30,
      },
      { id: PURCHASING.acme.valle, tenantId: ACME, code: 'PRV000002', name: 'Aguas del Valle', paymentTermDays: 0 },
      { id: PURCHASING.globex.supplier, tenantId: GLOBEX, code: 'PRV000001', name: 'Repuestos Industriales', paymentTermDays: 15 },
    ],
  });

  const orders = [
    {
      id: PURCHASING.acme.partialOrder, tenantId: ACME, code: 'OC000001', supplierId: PURCHASING.acme.andina,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-02'), expectedDate: date('2026-09-10'),
      notes: 'Reposición quincenal', status: 'partially_received' as const, confirmedAt: at('2026-09-02'),
      lines: [
        { id: PURCHASING.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 10, baseQuantity: 240, unitCost: 12, taxRate: 16, receivedQuantity: 4 },
        { id: PURCHASING.acme.partialDetergent, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 20, baseQuantity: 20, unitCost: 3.1, taxRate: 16, receivedQuantity: 0 },
      ],
    },
    {
      id: PURCHASING.acme.draftOrder, tenantId: ACME, code: 'OC000002', supplierId: PURCHASING.acme.valle,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-06'), expectedDate: null, notes: null,
      status: 'draft' as const, confirmedAt: null,
      lines: [{ id: PURCHASING.acme.draftWater, itemId: acme.items.water, unitId: acme.units.piece, quantity: 48, baseQuantity: 48, unitCost: 0.45, taxRate: 16, receivedQuantity: 0 }],
    },
    {
      id: PURCHASING.globex.confirmedOrder, tenantId: GLOBEX, code: 'OC000001', supplierId: PURCHASING.globex.supplier,
      warehouseId: globex.warehouses.main, orderDate: date('2026-09-03'), expectedDate: null, notes: 'Filtros para taller',
      status: 'confirmed' as const, confirmedAt: at('2026-09-03'),
      lines: [{ id: PURCHASING.globex.confirmedFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 20, baseQuantity: 20, unitCost: 8, taxRate: 16, receivedQuantity: 0 }],
    },
    {
      id: PURCHASING.globex.draftOrder, tenantId: GLOBEX, code: 'OC000002', supplierId: PURCHASING.globex.supplier,
      warehouseId: globex.warehouses.main, orderDate: date('2026-09-04'), expectedDate: null, notes: null,
      status: 'draft' as const, confirmedAt: null,
      lines: [{ id: PURCHASING.globex.draftFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, baseQuantity: 5, unitCost: 8, taxRate: 16, receivedQuantity: 0 }],
    },
  ];

  for (const { lines, ...order } of orders) {
    await prisma.purchaseOrder.create({ data: { ...order, ...dollars(order.tenantId), createdAt: order.orderDate, updatedAt: order.confirmedAt ?? order.orderDate } });
    await prisma.purchaseOrderLine.createMany({
      data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: order.tenantId, orderId: order.id, lineNumber: index + 1 })),
    });
  }

  const receipts = [
    {
      id: PURCHASING.acme.receipt, tenantId: ACME, code: 'ENT000001', orderId: PURCHASING.acme.partialOrder,
      warehouseId: acme.warehouses.main, receiptDate: date('2026-09-05'), notes: 'Llegaron 4 de 10 cajas',
      status: 'confirmed' as const, confirmedAt: at('2026-09-05'),
      lines: [{ id: PURCHASING.acme.receiptWater, orderLineId: PURCHASING.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 4, baseQuantity: 96, unitCost: 12 }],
    },
    {
      id: PURCHASING.globex.draftReceipt, tenantId: GLOBEX, code: 'ENT000001', orderId: PURCHASING.globex.confirmedOrder,
      warehouseId: globex.warehouses.main, receiptDate: date('2026-09-06'), notes: null,status: 'draft' as const, confirmedAt: null,
      lines: [{ id: PURCHASING.globex.draftReceiptFilter, orderLineId: PURCHASING.globex.confirmedFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, baseQuantity: 5, unitCost: 8 }],
    },
  ];

  for (const { lines, ...receipt } of receipts) {
    await prisma.goodsReceipt.create({ data: { ...receipt, ...dollars(receipt.tenantId), createdAt: receipt.receiptDate, updatedAt: receipt.confirmedAt ?? receipt.receiptDate } });
    await prisma.goodsReceiptLine.createMany({
      data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: receipt.tenantId, receiptId: receipt.id, lineNumber: index + 1 })),
    });
  }

  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.receiptMovement, tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, sequence: 2,
      direction: 'in', quantity: 96, unitCost: 0.5, balanceQuantity: 336, balanceAverageCost: 0.5, originType: 'receipt',
      originId: PURCHASING.acme.receipt, originLineId: PURCHASING.acme.receiptWater, originDate: at('2026-09-05'), occurredAt: at('2026-09-05'),
    },
  });
  await prisma.itemStock.update({
    where: { tenantId_itemId_warehouseId: { tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main } },
    data: { quantity: 336, lastSequence: 2, updatedAt: at('2026-09-05') },
  });

  for (const [tenantId, prefix, lastValue] of [
    [ACME, 'PRV', 2], [ACME, 'OC', 2], [ACME, 'ENT', 1],
    [GLOBEX, 'PRV', 1], [GLOBEX, 'OC', 2], [GLOBEX, 'ENT', 1],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Un pedido de Acme despachado en parte, con su despacho y su factura escritos como los
// escribiria el sistema: 2 cajas de agua salen al promedio de 0,50 y el agua pasa de 336 a 288. En
// Globex, lo que ataca la matriz de aislamiento.
async function seedSales(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);

  await prisma.customer.createMany({
    data: [
      {
        id: SALES.acme.delta, tenantId: ACME, code: 'CLI000001', name: 'Comercial Delta', fiscalId: 'J-40123456-7',
        email: 'compras@delta.com', phone: '+58 212 555 0202', address: 'Calle Real de Sabana Grande', paymentTermDays: 15, creditLimit: 1000,
      },
      { id: SALES.acme.corner, tenantId: ACME, code: 'CLI000002', name: 'Bodegón La Esquina', paymentTermDays: 0 },
      { id: SALES.globex.customer, tenantId: GLOBEX, code: 'CLI000001', name: 'Talleres Omega', paymentTermDays: 30, creditLimit: 500 },
    ],
  });

  const orders = [
    {
      id: SALES.acme.partialOrder, tenantId: ACME, code: 'PED000001', customerId: SALES.acme.delta, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido semanal', ...dollarsAt(150.25), status: 'partially_dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [
        { id: SALES.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 5, baseQuantity: 120, unitPrice: 30, taxRate: 16, dispatchedQuantity: 2 },
        { id: SALES.acme.partialDetergent, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 10, baseQuantity: 10, unitPrice: 5.5, taxRate: 16, dispatchedQuantity: 0 },
      ],
    },
    {
      id: SALES.acme.draftOrder, tenantId: ACME, code: 'PED000002', customerId: SALES.acme.corner, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-08'), notes: null, ...dollarsAt(152.4), status: 'draft' as const, confirmedAt: null,
      lines: [{ id: SALES.acme.draftWater, itemId: acme.items.water, unitId: acme.units.piece, quantity: 24, baseQuantity: 24, unitPrice: 1.5, taxRate: 16, dispatchedQuantity: 0 }],
    },
    {
      id: SALES.globex.partialOrder, tenantId: GLOBEX, code: 'PED000001', customerId: SALES.globex.customer, warehouseId: globex.warehouses.main,
      orderDate: date('2026-09-05'), notes: null, ...dollarsAt(141), status: 'partially_dispatched' as const, confirmedAt: at('2026-09-05'),
      lines: [{ id: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 10, baseQuantity: 10, unitPrice: 14, taxRate: 16, dispatchedQuantity: 5 }],
    },
    {
      id: SALES.globex.draftOrder, tenantId: GLOBEX, code: 'PED000002', customerId: SALES.globex.customer, warehouseId: globex.warehouses.main,
      orderDate: date('2026-09-07'), notes: null, ...dollarsAt(141), status: 'draft' as const, confirmedAt: null,
      lines: [{ id: SALES.globex.draftFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 3, baseQuantity: 3, unitPrice: 14, taxRate: 16, dispatchedQuantity: 0 }],
    },
  ];

  for (const { lines, ...order } of orders) {
    await prisma.salesOrder.create({ data: { ...order, createdAt: order.orderDate, updatedAt: order.confirmedAt ?? order.orderDate } });
    await prisma.salesOrderLine.createMany({ data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: order.tenantId, orderId: order.id, lineNumber: index + 1 })) });
  }

  const dispatches = [
    {
      id: SALES.acme.dispatch, tenantId: ACME, code: 'DES000001', orderId: SALES.acme.partialOrder, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Primera entrega', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.dispatchWater, orderLineId: SALES.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 2, baseQuantity: 48 }],
    },
    {
      id: SALES.globex.dispatch, tenantId: GLOBEX, code: 'DES000001', orderId: SALES.globex.partialOrder, warehouseId: globex.warehouses.main,
      dispatchDate: date('2026-09-06'), notes: null, status: 'confirmed' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.globex.dispatchFilter, orderLineId: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, baseQuantity: 5 }],
    },
    {
      id: SALES.globex.draftDispatch, tenantId: GLOBEX, code: 'DES000002', orderId: SALES.globex.partialOrder, warehouseId: globex.warehouses.main,
      dispatchDate: date('2026-09-08'), notes: null, status: 'draft' as const, confirmedAt: null,
      lines: [{ id: SALES.globex.draftDispatchFilter, orderLineId: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 2, baseQuantity: 2 }],
    },
  ];

  for (const { lines, ...dispatch } of dispatches) {
    await prisma.dispatch.create({ data: { ...dispatch, createdAt: dispatch.dispatchDate, updatedAt: dispatch.confirmedAt ?? dispatch.dispatchDate } });
    await prisma.dispatchLine.createMany({ data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: dispatch.tenantId, dispatchId: dispatch.id, lineNumber: index + 1 })) });
  }

  const invoices = [
    {
      id: SALES.acme.invoice, tenantId: ACME, code: 'FAC000001', dispatchId: SALES.acme.dispatch, orderId: SALES.acme.partialOrder, customerId: SALES.acme.delta,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 60, tax: 9.6, total: 69.6,
      ...dollarsAt(150.25), subtotalVes: 9015, taxVes: 1442.4, totalVes: 10457.4,
      line: { id: SALES.acme.invoiceWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 2, unitPrice: 30, taxRate: 16, subtotal: 60, tax: 9.6 },
    },
    {
      id: SALES.globex.invoice, tenantId: GLOBEX, code: 'FAC000001', dispatchId: SALES.globex.dispatch, orderId: SALES.globex.partialOrder, customerId: SALES.globex.customer,
      issueDate: date('2026-09-06'), dueDate: date('2026-10-06'), subtotal: 70, tax: 11.2, total: 81.2,
      ...dollarsAt(141), subtotalVes: 9870, taxVes: 1579.2, totalVes: 11449.2,
      line: { id: SALES.globex.invoiceFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, unitPrice: 14, taxRate: 16, subtotal: 70, tax: 11.2 },
    },
  ];

  for (const { line, ...invoice } of invoices) {
    await prisma.invoice.create({ data: { ...invoice, status: 'issued', createdAt: invoice.issueDate, updatedAt: invoice.issueDate } });
    await prisma.invoiceLine.create({ data: { ...line, ...labelsOf(line.itemId), tenantId: invoice.tenantId, invoiceId: invoice.id, lineNumber: 1 } });
  }

  const exits = [
    { id: SALES.acme.dispatchMovement, tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, sequence: 3, quantity: 48, cost: 0.5, balance: 288, originId: SALES.acme.dispatch, lineId: SALES.acme.dispatchWater, day: '2026-09-07' },
    { id: SALES.globex.dispatchMovement, tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, sequence: 2, quantity: 5, cost: 8.5, balance: 25, originId: SALES.globex.dispatch, lineId: SALES.globex.dispatchFilter, day: '2026-09-06' },
  ];

  for (const exit of exits) {
    await prisma.inventoryMovement.create({
      data: {
        id: exit.id, tenantId: exit.tenantId, itemId: exit.itemId, warehouseId: exit.warehouseId, sequence: exit.sequence, direction: 'out',
        quantity: exit.quantity, unitCost: exit.cost, balanceQuantity: exit.balance, balanceAverageCost: exit.cost, originType: 'dispatch',
        originId: exit.originId, originLineId: exit.lineId, originDate: at(exit.day), occurredAt: at(exit.day),
      },
    });
    await prisma.itemStock.update({
      where: { tenantId_itemId_warehouseId: { tenantId: exit.tenantId, itemId: exit.itemId, warehouseId: exit.warehouseId } },
      data: { quantity: exit.balance, lastSequence: exit.sequence, updatedAt: at(exit.day) },
    });
  }

  for (const [tenantId, prefix, lastValue] of [
    [ACME, 'CLI', 2], [ACME, 'PED', 2], [ACME, 'DES', 1], [ACME, 'FAC', 1],
    [GLOBEX, 'CLI', 1], [GLOBEX, 'PED', 2], [GLOBEX, 'DES', 2], [GLOBEX, 'FAC', 1],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Delta abono 30 a su factura de 69,60, que queda con 39,60 por cobrar. Globex tiene un cobro
// confirmado y un borrador: son los blancos de la matriz de aislamiento.
async function seedReceivables(prisma: PrismaClient): Promise<void> {
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);

  const payments = [
    {
      id: SALES.acme.payment, tenantId: ACME, code: 'COB000001', customerId: SALES.acme.delta, paymentDate: date('2026-09-10'), method: 'transfer' as const,
      reference: 'TRF-88231', amount: 30, ...dollarsAt(152.4), amountVes: 4572, difference: 64.5, status: 'confirmed' as const, confirmedAt: at('2026-09-10'),
      allocation: { id: SALES.acme.paymentAllocation, invoiceId: SALES.acme.invoice },
    },
    {
      id: SALES.globex.confirmedPayment, tenantId: GLOBEX, code: 'COB000001', customerId: SALES.globex.customer, paymentDate: date('2026-09-08'), method: 'cash' as const,
      reference: null, amount: 20, ...dollarsAt(141), amountVes: 2820, difference: 0, status: 'confirmed' as const, confirmedAt: at('2026-09-08'),
      allocation: { id: SALES.globex.confirmedAllocation, invoiceId: SALES.globex.invoice },
    },
    {
      id: SALES.globex.draftPayment, tenantId: GLOBEX, code: 'COB000002', customerId: SALES.globex.customer, paymentDate: date('2026-09-09'), method: 'transfer' as const,
      reference: null, amount: 10, ...dollarsAt(141), amountVes: 1410, difference: 0, status: 'draft' as const, confirmedAt: null,
      allocation: { id: SALES.globex.draftAllocation, invoiceId: SALES.globex.invoice },
    },
  ];

  // Lo cobrado a la tasa del cobro menos lo facturado a la de la factura: 30 USD de 150,25 a 152,40 son 64,50 Bs.
  for (const { allocation, difference, ...payment } of payments) {
    await prisma.customerPayment.create({ data: { ...payment, createdAt: payment.paymentDate, updatedAt: payment.confirmedAt ?? payment.paymentDate } });
    await prisma.paymentAllocation.create({
      data: { ...allocation, tenantId: payment.tenantId, paymentId: payment.id, amount: payment.amount, exchangeRate: payment.exchangeRate, exchangeDifference: difference },
    });
  }

  for (const [tenantId, lastValue] of [
    [ACME, 1],
    [GLOBEX, 2],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, 'COB', ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// La empresa de las guardas de rendimiento: 50 clientes, 5.000 facturas con su pedido y su despacho,
// y 3.000 cobros confirmados. Se genera en SQL con identificadores derivados del numero de fila: en
// segundos, y siempre igual.
async function seedVolume(prisma: PrismaClient): Promise<void> {
  const warehouse = 'e3000000-0000-4000-8000-000000000401';

  await prisma.warehouse.create({ data: { id: warehouse, tenantId: VOLUME, code: 'BOD000001', name: 'Central', isDefault: true } });

  await prisma.$executeRaw`
    INSERT INTO customers (id, tenant_id, code, name, payment_term_days, updated_at)
    SELECT md5('vol-customer-' || n)::uuid, ${VOLUME}::uuid, 'CLI' || lpad(n::text, 6, '0'), 'Cliente volumen ' || lpad(n::text, 2, '0'), 30, now()
    FROM generate_series(1, 50) AS n`;

  await prisma.$executeRaw`
    INSERT INTO sales_orders (id, tenant_id, code, customer_id, warehouse_id, order_date, status, confirmed_at, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate)
    SELECT md5('vol-order-' || n)::uuid, ${VOLUME}::uuid, 'PED' || lpad(n::text, 6, '0'), md5('vol-customer-' || (n % 50 + 1))::uuid, ${warehouse}::uuid,
           date '2026-01-01' + (n % 250), 'dispatched'::sales_order_status, now(), now(), 'USD', 140, 'USD', 140, false
    FROM generate_series(1, 5000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO dispatches (id, tenant_id, code, order_id, warehouse_id, dispatch_date, status, confirmed_at, updated_at)
    SELECT md5('vol-dispatch-' || n)::uuid, ${VOLUME}::uuid, 'DES' || lpad(n::text, 6, '0'), md5('vol-order-' || n)::uuid, ${warehouse}::uuid,
           date '2026-01-01' + (n % 250), 'confirmed'::dispatch_status, now(), now()
    FROM generate_series(1, 5000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO invoices (id, tenant_id, code, dispatch_id, order_id, customer_id, issue_date, due_date, status, subtotal, tax, total, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate, subtotal_ves, tax_ves, total_ves)
    SELECT md5('vol-invoice-' || n)::uuid, ${VOLUME}::uuid, 'FAC' || lpad(n::text, 6, '0'), md5('vol-dispatch-' || n)::uuid, md5('vol-order-' || n)::uuid,
           md5('vol-customer-' || (n % 50 + 1))::uuid, date '2026-01-01' + (n % 250), date '2026-01-31' + (n % 250), 'issued'::invoice_status,
           10 + n % 90, 0, 10 + n % 90, now(), 'USD', 140, 'USD', 140, false, (10 + n % 90) * 140, 0, (10 + n % 90) * 140
    FROM generate_series(1, 5000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO customer_payments (id, tenant_id, code, customer_id, payment_date, method, amount, status, confirmed_at, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate, amount_ves)
    SELECT md5('vol-payment-' || n)::uuid, ${VOLUME}::uuid, 'COB' || lpad(n::text, 6, '0'), md5('vol-customer-' || (n % 50 + 1))::uuid,
           date '2026-01-01' + (n % 250), 'transfer'::payment_method, 5, 'confirmed'::payment_status, now(), now(), 'USD', 140, 'USD', 140, false, 700
    FROM generate_series(1, 3000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO payment_allocations (id, tenant_id, payment_id, invoice_id, amount, exchange_rate, exchange_difference)
    SELECT md5('vol-allocation-' || n)::uuid, ${VOLUME}::uuid, md5('vol-payment-' || n)::uuid, md5('vol-invoice-' || n)::uuid, 5, 140, 0
    FROM generate_series(1, 3000) AS n`;

  for (const [prefix, lastValue] of [['CLI', 50], ['PED', 5000], ['DES', 5000], ['FAC', 5000], ['COB', 3000], ['BOD', 1]] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${VOLUME}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

await main();
