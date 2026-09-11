import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ACCESS_PERMISSIONS } from '../src/contexts/access/domain/role/permissions.catalog.js';

// Sincroniza el catalogo de permisos declarado en el codigo. Lo corre `make migrate`,
// asi que pasa en esta maquina, en el CI y en el servidor por igual — nunca depende
// de que alguien ejecute una prueba.
//
// Es idempotente: correrlo diez veces deja el mismo resultado. Y NUNCA borra. Quitar
// un permiso del catalogo no puede arrastrar los role_permissions de las empresas que
// ya lo tenian concedido; retirar un permiso es una decision explicita, con su
// migracion.
const CATALOGS = [ACCESS_PERMISSIONS];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to synchronize the permission catalog.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const permissions = CATALOGS.flat();

    for (const { code, description } of permissions) {
      await prisma.permission.upsert({
        where: { code },
        create: { code, description },
        update: { description },
      });
    }

    const orphans = await prisma.permission.findMany({
      where: { code: { notIn: permissions.map((permission) => permission.code) } },
      select: { code: true },
    });

    console.log(`  permisos sincronizados: ${permissions.length}`);

    // No se borran, pero se avisa: una fila huerfana suele ser un permiso que se
    // renombro y dejo roles apuntando al nombre viejo.
    if (orphans.length > 0) {
      console.warn(
        `  aviso: ${orphans.length} en la base que ya no estan en el catalogo: ` +
          orphans.map((orphan) => orphan.code).join(', '),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
