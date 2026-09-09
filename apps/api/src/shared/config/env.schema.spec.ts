import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const validDatabaseUrl = 'postgresql://user:pass@db:5432/nexora?schema=public';

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_URL: validDatabaseUrl,
    });

    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('production');
  });

  it('applies development defaults when values are missing', () => {
    const env = validateEnv({ DATABASE_URL: validDatabaseUrl });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('fails when DATABASE_URL is not a PostgreSQL connection string', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://user@host/db' })).toThrow(
      /PostgreSQL connection string/,
    );
  });

  it('fails when PORT is not a number', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: validDatabaseUrl, PORT: 'ocho mil' }),
    ).toThrow(/PORT/);
  });

  // La guarda que evita el accidente clasico: desplegar apuntando a la base local.
  it('rejects a localhost database while NODE_ENV is production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
      }),
    ).toThrow(/localhost while NODE_ENV=production/);
  });

  it('allows a localhost database in development', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
    });

    expect(env.DATABASE_URL).toContain('localhost');
  });
});
