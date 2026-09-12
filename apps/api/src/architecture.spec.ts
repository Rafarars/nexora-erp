import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const IMPORT_PATTERN = /from\s+'([^']+)'/g;

// En la raiz de src y no dentro de un contexto: vigila TODOS los contextos, tambien
// los que nazcan en el H2, y el dominio compartido. Vivia en contexts/access y solo
// miraba ese contexto.
function productionFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      return entry === 'testing' ? [] : productionFiles(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

const contexts = readdirSync(join(SRC, 'contexts')).filter((entry) =>
  statSync(join(SRC, 'contexts', entry)).isDirectory(),
);

const layer = (name: 'domain' | 'application') =>
  contexts.flatMap((context) => productionFiles(join(SRC, 'contexts', context, name)));

const domain = [...layer('domain'), ...productionFiles(join(SRC, 'shared', 'domain'))];
const application = layer('application');

function importsOf(path: string): string[] {
  return [...readFileSync(path, 'utf8').matchAll(IMPORT_PATTERN)].map((match) => match[1]);
}

function named(files: string[]): Array<[string, string]> {
  return files.map((path) => [relative(SRC, path).split(sep).join('/'), path]);
}

describe('architecture of every context', () => {
  it('finds contexts and files in both inner layers', () => {
    expect(contexts.length).toBeGreaterThan(0);
    expect(domain.length).toBeGreaterThan(0);
    expect(application.length).toBeGreaterThan(0);
  });

  it.each(named([...domain, ...application]))('%s imports only local code', (_name, path) => {
    expect(importsOf(path).filter((specifier) => !specifier.startsWith('.'))).toEqual([]);
  });

  it.each(named(application))('%s does not reach into infrastructure', (_name, path) => {
    expect(importsOf(path).filter((specifier) => specifier.includes('infrastructure'))).toEqual([]);
  });

  it.each(named(domain))('%s does not know the outer layers', (_name, path) => {
    const leaking = importsOf(path).filter(
      (specifier) => specifier.includes('/application/') || specifier.includes('/infrastructure/'),
    );

    expect(leaking).toEqual([]);
  });
});
