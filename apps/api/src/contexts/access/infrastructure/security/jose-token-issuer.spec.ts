import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JoseTokenIssuer } from './jose-token-issuer.js';
import { InvalidTokenError } from './invalid-token.error.js';
import type { Env } from '../../../../shared/config/env.schema.js';
import { TENANT_A, USER_A } from '../../domain/testing/access.mother.js';

const SECRET = 'a-private-secret-long-enough-for-tests';

function issuerWith(ttl = 3600): JoseTokenIssuer {
  return new JoseTokenIssuer(
    new ConfigService<Env, true>({ JWT_SECRET: SECRET, JWT_TTL_SECONDS: ttl }),
  );
}

const payload = {
  userId: USER_A,
  tenantId: TENANT_A,
  permissions: ['access.users.create'],
  grantsAll: false,
};

describe('JoseTokenIssuer', () => {
  it('reads back what it signed', async () => {
    const issuer = issuerWith();
    const { token } = await issuer.issue(payload);

    expect(await issuer.verify(token)).toEqual(payload);
  });

  it('reports how long the session lasts', async () => {
    expect((await issuerWith(900).issue(payload)).expiresInSeconds).toBe(900);
  });

  // La razon por la que el tenantId viaja en el token: cambiarlo invalida la firma.
  it('rejects a token whose payload was tampered with', async () => {
    const { token } = await issuerWith().issue(payload);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...payload, tenantId: 'another-tenant' }),
    ).toString('base64url');

    await expect(issuerWith().verify(`${header}.${forged}.${signature}`)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = new JoseTokenIssuer(
      new ConfigService<Env, true>({
        JWT_SECRET: 'a-different-secret-of-enough-length',
        JWT_TTL_SECONDS: 3600,
      }),
    );
    const { token } = await foreign.issue(payload);

    await expect(issuerWith().verify(token)).rejects.toThrow(InvalidTokenError);
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));

    await expect(issuerWith().verify(expired)).rejects.toThrow(InvalidTokenError);
  });

  // El ataque clasico contra JWT: firmar con `alg: none` y que el servidor lo acepte.
  it('rejects an unsigned token', async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.`;

    await expect(issuerWith().verify(unsigned)).rejects.toThrow(InvalidTokenError);
  });

  // Fallar al construir y no al firmar: el error aparece al arrancar, no cuando el
  // primer usuario intenta entrar.
  it('refuses to be built without a usable session length', () => {
    expect(
      () => new JoseTokenIssuer(new ConfigService<Env, true>({ JWT_SECRET: SECRET })),
    ).toThrow(/JWT_TTL_SECONDS/);
  });

  it('rejects nonsense instead of failing with a server error', async () => {
    await expect(issuerWith().verify('not-a-token')).rejects.toThrow(InvalidTokenError);
  });
});
