export interface UserAuthenticatorRequest {
  email: string;
  password: string;
  // Opcional: sin ella se entra a la primera empresa disponible y el usuario cambia
  // despues con switch-tenant, sin pedirle que elija antes de saber que existe.
  tenantSlug?: string;
}
