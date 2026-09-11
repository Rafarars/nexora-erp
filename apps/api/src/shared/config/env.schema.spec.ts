import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const validDatabaseUrl = 'postgresql://user:pass@db:5432/nexora?schema=public';
const validSecret = 'a-private-secret-long-enough-for-production';

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_URL: validDatabaseUrl,
      JWT_SECRET: validSecret,
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
        JWT_SECRET: validSecret,
      }),
    ).toThrow(/localhost while NODE_ENV=production/);
  });

  // Sin esto, cualquiera que lea el repositorio podria firmar un token valido.
  it('rejects the example secret while NODE_ENV is production', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: validDatabaseUrl }),
    ).toThrow(/JWT_SECRET must be set to a private value/);
  });

  it('rejects a short secret while NODE_ENV is production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: validDatabaseUrl,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/at least 32 characters/);
  });

  it('allows the development secret outside production', () => {
    expect(validateEnv({ DATABASE_URL: validDatabaseUrl }).JWT_SECRET.length)
      .toBeGreaterThan(0);
  });

  it('reads how long a session lasts', () => {
    const env = validateEnv({ DATABASE_URL: validDatabaseUrl, JWT_TTL_SECONDS: '900' });

    expect(env.JWT_TTL_SECONDS).toBe(900);
  });

  it('allows a localhost database in development', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
    });

    expect(env.DATABASE_URL).toContain('localhost');
  });
});
