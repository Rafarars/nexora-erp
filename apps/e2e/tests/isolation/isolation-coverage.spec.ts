import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { ISOLATION_CASES } from '../../support/isolation-matrix.js';

const CONTROLLERS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../api/src/contexts/access/infrastructure/http',
);

// Rutas que reciben identificadores pero no hace falta atacar: la sesion es la unica
// fuente de la empresa y de la persona, asi que no hay nada ajeno que pasarles.
const EXEMPT = new Set(['POST /api/v1/auth/switch-tenant']);

const IDENTIFIER_FIELD = /\b(userId|roleId|roleIds|tenantId)\s*:/;

// Los campos que llegan en el cuerpo, leidos del DTO que importa el controlador. Mirar
// el controlador entero daba falsos positivos: todos usan `session.tenantId`, que sale
// del token y no lo elige quien llama.
function bodyTakesIdentifiers(controllerSource: string): boolean {
  const dto = controllerSource.match(/from '(\.\/dto\/[^']+)\.js'/)?.[1];

  if (!dto) return false;

  return IDENTIFIER_FIELD.test(readFileSync(path.join(CONTROLLERS, `${dto}.ts`), 'utf8'));
}

// Las rutas donde quien llama elige un identificador: en la ruta o en el cuerpo.
function routesTakingIdentifiers(): string[] {
  return readdirSync(CONTROLLERS)
    .filter((file) => file.endsWith('.controller.ts'))
    .flatMap((file) => {
      const source = readFileSync(path.join(CONTROLLERS, file), 'utf8');
      const base = source.match(/@Controller\('([^']+)'\)/)?.[1] ?? '';
      const route = source.match(/@(Get|Post|Put|Delete)\((?:'([^']*)')?\)/);

      if (!route) return [];

      const full = `${route[1].toUpperCase()} /${[base, route[2]].filter(Boolean).join('/')}`;

      return full.includes(':') || bodyTakesIdentifiers(source) ? [full] : [];
    });
}

// No prueba el sistema: prueba que la matriz no se quede atras. Un endpoint nuevo
// que recibe identificadores falla aqui hasta que alguien le escriba su ataque.
test('every route that takes an identifier has an isolation case', () => {
  const covered = new Set(ISOLATION_CASES.map((attack) => attack.route));
  const missing = routesTakingIdentifiers().filter(
    (route) => !covered.has(route) && !EXEMPT.has(route),
  );

  expect(missing).toEqual([]);
});

test('finds routes to check, so an empty scan cannot pass by accident', () => {
  expect(routesTakingIdentifiers().length).toBeGreaterThanOrEqual(ISOLATION_CASES.length);
});
