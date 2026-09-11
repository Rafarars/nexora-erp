import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CONTEXT_DIR = dirname(fileURLToPath(import.meta.url));
const IMPORT_PATTERN = /from\s+'([^']+)'/g;

// Los dobles de prueba viven en `testing/` y si importan infraestructura: no entran
// al artefacto de produccion, y `tsconfig.build.json` los excluye por el mismo motivo.
function productionFiles(layer: string): string[] {
  const root = join(CONTEXT_DIR, layer);

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);

      if (statSync(path).isDirectory()) {
        return entry === 'testing' ? [] : walk(path);
      }

      return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
    });

  return walk(root);
}

function importsOf(path: string): string[] {
  return [...readFileSync(path, 'utf8').matchAll(IMPORT_PATTERN)].map((match) => match[1]);
}

function named(files: string[]): Array<[string, string]> {
  return files.map((path) => [relative(CONTEXT_DIR, path).split(sep).join('/'), path]);
}

// No verifican una funcionalidad, verifican una propiedad del sistema entero: si el
// dominio importa NestJS o Prisma, la hexagonal esta rota y se sabe el mismo dia.
describe('access architecture', () => {
  const domain = productionFiles('domain');
  const application = productionFiles('application');

  it('has files to check in both inner layers', () => {
    expect(domain.length).toBeGreaterThan(0);
    expect(application.length).toBeGreaterThan(0);
  });

  it.each(named([...domain, ...application]))('%s imports only local code', (_name, path) => {
    const external = importsOf(path).filter((specifier) => !specifier.startsWith('.'));

    expect(external).toEqual([]);
  });

  // La direccion de las dependencias: la aplicacion conoce el dominio, nunca al reves.
  it.each(named(application))('%s does not reach into infrastructure', (_name, path) => {
    const leaking = importsOf(path).filter((specifier) => specifier.includes('infrastructure'));

    expect(leaking).toEqual([]);
  });

  it.each(named(domain))('%s does not know the application layer', (_name, path) => {
    const leaking = importsOf(path).filter(
      (specifier) => specifier.includes('application') || specifier.includes('infrastructure'),
    );

    expect(leaking).toEqual([]);
  });
});
