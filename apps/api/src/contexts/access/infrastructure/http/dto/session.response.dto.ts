import { AccessSessionResponse } from '../../../application/session/access-session.response.js';
import { IssuedToken } from '../../security/token-issuer.js';

export interface SessionResponseDto {
  token: string;
  expiresInSeconds: number;
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string };
  permissions: string[];
  grantsAll: boolean;
  availableTenants: { id: string; name: string; slug: string }[];
}

// La entidad de dominio nunca sale por HTTP. Y el hash de la contrasena no aparece
// aqui ni por descuido, porque este tipo no lo contempla.
export function toSessionResponse(
  session: AccessSessionResponse,
  issued: IssuedToken,
): SessionResponseDto {
  return {
    token: issued.token,
    expiresInSeconds: issued.expiresInSeconds,
    user: { id: session.userId, name: session.name, email: session.email },
    tenant: { id: session.tenantId, name: session.tenantName },
    permissions: session.permissions,
    grantsAll: session.grantsAll,
    availableTenants: session.availableTenants,
  };
}
