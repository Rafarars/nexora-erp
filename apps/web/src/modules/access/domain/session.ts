export interface AvailableTenant {
  id: string;
  name: string;
  slug: string;
}

// El modelo propio, no el espejo de la API. Hoy tienen casi la misma forma; el dia
// que la API cambie, la traduccion ya existe y solo se toca el adaptador.
export interface Session {
  userId: string;
  name: string;
  email: string;
  tenantId: string;
  tenantName: string;
  permissions: string[];
  grantsAll: boolean;
  availableTenants: AvailableTenant[];
}

// Quien puede todo no enumera permisos: sin esto la interfaz le esconderia los
// botones al administrador.
export function can(session: Session, permission: string): boolean {
  return session.grantsAll || session.permissions.includes(permission);
}

export function belongsToSeveralTenants(session: Session): boolean {
  return session.availableTenants.length > 1;
}
