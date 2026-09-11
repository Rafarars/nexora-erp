export interface AvailableTenantResponse {
  id: string;
  name: string;
  slug: string;
}

// Lo que iniciar sesion y cambiar de empresa devuelven por igual. Quien emite el token
// es infraestructura: aqui no aparece la palabra JWT.
export interface AccessSessionResponse {
  userId: string;
  name: string;
  email: string;
  tenantId: string;
  tenantName: string;
  permissions: string[];
  availableTenants: AvailableTenantResponse[];
}
