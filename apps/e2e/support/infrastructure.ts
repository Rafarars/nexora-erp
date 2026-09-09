import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function compose(...args: string[]): void {
  execFileSync('docker', ['compose', ...args], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
}

export function stopDatabase(): void {
  compose('stop', 'db');
}

export function startDatabase(): void {
  compose('start', 'db');
}
