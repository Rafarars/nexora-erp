// Las semillas borran a toda persona que no sea de demostracion. Mirar NODE_ENV no
// basta: con un DATABASE_URL real exportado en la terminal, correr las pruebas borraria
// los usuarios de verdad. Se exige que la base sea desechable por DONDE esta.
const DISPOSABLE_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'db'];

export function assertDisposableDatabase(connectionString: string): void {
  let hostname: string;

  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid connection string.');
  }

  if (!DISPOSABLE_HOSTS.includes(hostname)) {
    throw new Error(
      `Refusing to seed "${hostname}": the demo seed deletes every non-demo user and ` +
        'only runs against a local or CI database.',
    );
  }
}
