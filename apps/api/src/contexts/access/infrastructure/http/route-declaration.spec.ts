import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACCESS_PERMISSIONS } from '../../domain/role/permissions.catalog.js';

const API_SRC = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REQUIRED_PERMISSION = /@RequirePermission\('([^']+)'\)/g;

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      return entry === 'node_modules' || entry === 'generated' ? [] : controllerFiles(path);
    }

    return path.endsWith('.controller.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

// Parte el archivo por rutas y le atribuye a cada una SOLO los decoradores que
// tiene inmediatamente encima, sin mirar lineas de la siguiente. Una ventana de
// lineas alrededor daba falsos verdes: una ruta sin declarar pasaba porque el
// bloque alcanzaba el decorador del metodo de al lado.
export function routesOf(source: string): { handler: string; declaration: string }[] {
  const lines = source.split('\n');
  const routes: { handler: string; declaration: string }[] = [];

  let pending: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('@')) {
      pending.push(trimmed);
      continue;
    }

    const isRoute = pending.some((decorator) =>
      /^@(Get|Post|Put|Patch|Delete|All)\(/.test(decorator),
    );

    if (isRoute && trimmed.length > 0) {
      routes.push({ handler: trimmed, declaration: pending.join('\n') });
    }

    // Una linea que no es decorador cierra el bloque, sea la firma del metodo o un
    // hueco: asi los decoradores nunca se atribuyen a la ruta equivocada.
    if (trimmed.length > 0 || pending.length > 0) {
      pending = [];
    }
  }

  return routes;
}

const files = controllerFiles(API_SRC);

// NO verifica una funcionalidad: verifica una propiedad del sistema entero. Un
// endpoint nuevo que nadie declare hace fallar esta prueba el mismo dia, en vez de
// quedar abierto o cerrado por accidente.
describe('every route declares who can reach it', () => {
  it('finds controllers to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((path) => [relative(API_SRC, path).split(sep).join('/'), path]))(
    '%s declares a permission, authentication or public access on every route',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');

      for (const route of routesOf(source)) {
        const declared =
          route.declaration.includes('@RequirePermission(') ||
          route.declaration.includes('@Public()') ||
          route.declaration.includes('@AuthenticatedOnly()');

        expect(declared, `undeclared route in ${path}: ${route.handler}`).toBe(true);
      }
    },
  );
});

// La segunda fuente de verdad que hay que mantener cuadrada: si el decorador y el
// catalogo se separan, el endpoint queda inalcanzable —ningun rol puede tener un
// permiso que no existe— y nadie lo nota hasta produccion.
describe('declared permissions match the catalog', () => {
  const catalog = new Set(ACCESS_PERMISSIONS.map((permission) => permission.code));

  const declared = new Set(
    files.flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(REQUIRED_PERMISSION)].map((match) => match[1]),
    ),
  );

  it('declares at least one permission somewhere', () => {
    expect(declared.size).toBeGreaterThan(0);
  });

  it('every permission a route requires exists in the catalog', () => {
    expect([...declared].filter((permission) => !catalog.has(permission))).toEqual([]);
  });

  // Al reves tambien: un permiso que nadie exige es basura que alguien concedera sin
  // que sirva para nada.
  it('every permission in the catalog is required by some route', () => {
    expect([...catalog].filter((permission) => !declared.has(permission))).toEqual([]);
  });
});

// El analizador se prueba a si mismo: si se equivoca, la suite entera deja de vigilar
// sin que nadie se entere. Estos casos vienen de un falso verde real.
describe('the route parser attributes decorators to the right route', () => {
  it('detects a route with no declaration next to a declared one', () => {
    const source = [
      '  @Get()',
      '  async leak() {}',
      '',
      '  @Post()',
      "  @RequirePermission('access.users.create')",
      '  async guarded() {}',
    ].join('\n');

    const routes = routesOf(source);

    expect(routes).toHaveLength(2);
    expect(routes[0].declaration).not.toContain('@RequirePermission');
    expect(routes[1].declaration).toContain('@RequirePermission');
  });

  it('keeps the declarations that do belong to a route', () => {
    const source = [
      '  @Post()',
      '  @HttpCode(HttpStatus.OK)',
      '  @Public()',
      '  async run() {}',
    ].join('\n');

    expect(routesOf(source)[0].declaration).toContain('@Public()');
  });

  it('ignores decorators that are not routes', () => {
    const source = ['  @Injectable()', '  class Something {}'].join('\n');

    expect(routesOf(source)).toEqual([]);
  });
});
