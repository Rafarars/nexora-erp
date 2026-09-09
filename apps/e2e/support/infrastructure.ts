import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const DB_CONTAINER = 'nexora-db';

// Hosts contra los que se permite operar de forma destructiva: la maquina del
// desarrollador y los servicios del compose del CI. Cualquier otro es un
// entorno real y no se toca.
const DISPOSABLE_HOSTS = ['localhost', '127.0.0.1', '::1', 'api', 'web', 'db'];

function assertDisposableEnvironment(): void {
  const targets = [process.env.API_URL, process.env.WEB_URL].filter(
    (url): url is string => Boolean(url),
  );

  for (const target of targets) {
    const { hostname } = new URL(target);
    if (!DISPOSABLE_HOSTS.includes(hostname)) {
      throw new Error(
        `Prueba destructiva abortada: "${hostname}" no es un entorno desechable. ` +
          'Las pruebas que apagan la base de datos solo pueden correr en local o en CI.',
      );
    }
  }
}

function compose(...args: string[]): void {
  execFileSync('docker', ['compose', ...args], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
}

// Nunca `down -v`: eso borraria el volumen y con el los datos.
export function stopDatabase(): void {
  assertDisposableEnvironment();
  compose('stop', 'db');
}

export function startDatabase(): void {
  compose('start', 'db');
}

function healthStatus(): string {
  try {
    return execFileSync(
      'docker',
      ['inspect', '--format', '{{.State.Health.Status}}', DB_CONTAINER],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return 'unknown';
  }
}

export async function waitForHealthyDatabase(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (healthStatus() === 'healthy') return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `La base de datos no quedo sana en ${timeoutMs} ms (estado: ${healthStatus()}).`,
  );
}
