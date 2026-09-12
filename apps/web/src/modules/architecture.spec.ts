import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MODULES = dirname(fileURLToPath(import.meta.url));
const IMPORT_PATTERN = /from\s+['"]([^'"]+)['"]/g;

// Lo que modules/ no puede tocar: el framework de interfaz y las capas que dependen de el.
const FORBIDDEN = [/^react/, /^next/, /^@\/app\//, /^@\/sections\//, /^@\/shared\/session/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) return files(path);

    return /\.tsx?$/.test(path) && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

const sources = files(MODULES);

// modules/ debe poder probarse sin montar un componente. Nada lo vigilaba.
describe('modules/ knows nothing about React or Next', () => {
  it('finds modules to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources.map((path) => [relative(MODULES, path).split(sep).join('/'), path]))(
    '%s imports no framework',
    (_name, path) => {
      const imports = [...readFileSync(path, 'utf8').matchAll(IMPORT_PATTERN)].map((m) => m[1]);

      expect(imports.filter((specifier) => FORBIDDEN.some((rule) => rule.test(specifier)))).toEqual([]);
    },
  );
});
