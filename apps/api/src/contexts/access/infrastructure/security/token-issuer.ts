export const TOKEN_ISSUER = Symbol('TokenIssuer');

// Lo que viaja dentro del token. El `tenantId` va AQUI y no en una cabecera: una
// cabecera la elige quien llama, esto lo firma el servidor.
export interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  permissions: string[];
  grantsAll: boolean;
}

export interface IssuedToken {
  token: string;
  expiresInSeconds: number;
}

export interface TokenIssuer {
  issue(payload: AccessTokenPayload): Promise<IssuedToken>;
  verify(token: string): Promise<AccessTokenPayload>;
}
