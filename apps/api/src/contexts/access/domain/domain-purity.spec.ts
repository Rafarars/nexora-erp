import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DOMAIN_DIR = dirname(fileURLToPath(import.meta.url));
const IMPORT_PATTERN = /from\s+'([^']+)'/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return path.endsWith('.ts') ? [path] : [];
  });
}

function importsOf(path: string): string[] {
  return [...readFileSync(path, 'utf8').matchAll(IMPORT_PATTERN)].map((match) => match[1]);
}

// No verifica una funcionalidad, verifica una propiedad del sistema entero: si el
// dominio importa NestJS o Prisma, la hexagonal esta rota y la prueba lo dice el
// mismo dia, no tres meses despues.
describe('domain purity', () => {
  const files = sourceFiles(DOMAIN_DIR).filter((path) => !path.endsWith('.spec.ts'));

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((path) => [path.slice(DOMAIN_DIR.length + 1), path]))(
    '%s imports only local code',
    (_name, path) => {
      const external = importsOf(path).filter((specifier) => !specifier.startsWith('.'));

      expect(external).toEqual([]);
    },
  );
});
