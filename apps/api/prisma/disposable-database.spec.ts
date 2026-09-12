import { describe, expect, it } from 'vitest';
import { assertDisposableDatabase } from './disposable-database.js';

describe('assertDisposableDatabase', () => {
  it.each([
    'postgresql://nexora:nexora@localhost:5432/nexora',
    'postgresql://nexora:nexora@127.0.0.1:5432/nexora',
    'postgresql://nexora:nexora@db:5432/nexora',
  ])('accepts a local or compose database: %s', (url) => {
    expect(() => assertDisposableDatabase(url)).not.toThrow();
  });

  // El caso que motivo la guarda: una URL real exportada en la terminal.
  it.each([
    'postgresql://user:pass@db.xyz.supabase.co:5432/postgres',
    'postgresql://user:pass@10.0.0.12:5432/erp',
    'postgresql://user:pass@localhost.attacker.com:5432/erp',
  ])('refuses any other host: %s', (url) => {
    expect(() => assertDisposableDatabase(url)).toThrow(/Refusing to seed/);
  });

  it('refuses a malformed connection string', () => {
    expect(() => assertDisposableDatabase('not a url')).toThrow(/not a valid/);
  });
});
