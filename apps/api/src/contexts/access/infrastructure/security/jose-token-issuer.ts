import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../../../../shared/config/env.schema.js';
import { InvalidTokenError } from './invalid-token.error.js';
import {
  AccessTokenPayload,
  IssuedToken,
  TokenIssuer,
} from './token-issuer.js';

const ALGORITHM = 'HS256';

@Injectable()
export class JoseTokenIssuer implements TokenIssuer {
  private readonly secret: Uint8Array;
  private readonly ttl: number;

  constructor(config: ConfigService<Env, true>) {
    this.secret = new TextEncoder().encode(config.get('JWT_SECRET', { infer: true }));
    this.ttl = Number(config.get('JWT_TTL_SECONDS', { infer: true }));

    // Se comprueba al construir, no al firmar: un fallo de configuracion rompe el
    // arranque en vez de saltar en la primera peticion con un error ilegible.
    if (!Number.isInteger(this.ttl) || this.ttl <= 0) {
      throw new Error('JWT_TTL_SECONDS must be a positive number of seconds.');
    }
  }

  async issue(payload: AccessTokenPayload): Promise<IssuedToken> {
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: ALGORITHM })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + this.ttl)
      .sign(this.secret);

    return { token, expiresInSeconds: this.ttl };
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      // Fijar el algoritmo es obligatorio: sin esto, un token firmado con `alg: none`
      // o con un algoritmo mas debil pasaria la verificacion.
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ALGORITHM],
      });

      return {
        userId: String(payload.userId),
        tenantId: String(payload.tenantId),
        permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
        grantsAll: payload.grantsAll === true,
      };
    } catch {
      throw new InvalidTokenError();
    }
  }
}
