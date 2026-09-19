export const TOKEN_ISSUER = Symbol('TokenIssuer');

// Lo que viaja dentro del token. El `tenantId` va AQUI y no en una cabecera: una
// cabecera la elige quien llama, esto lo firma el servidor.
export interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  permissions: string[];
  grantsAll: boolean;
}

// Lo mismo mas cuando se firmo. En MILISEGUNDOS y en un campo propio: el `iat` estandar
// va en segundos, y dos sesiones del mismo segundo no se distinguirian entre si.
export interface VerifiedToken extends AccessTokenPayload {
  issuedAtMs: number;
}

export interface IssuedToken {
  token: string;
  expiresInSeconds: number;
}

export interface TokenIssuer {
  issue(payload: AccessTokenPayload): Promise<IssuedToken>;
  verify(token: string): Promise<VerifiedToken>;
}
