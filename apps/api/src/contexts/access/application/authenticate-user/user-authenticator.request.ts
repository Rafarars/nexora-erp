export interface UserAuthenticatorRequest {
  email: string;
  password: string;
  // De donde llega el intento. Sirve para frenar a quien prueba correos al azar buscando
  // a quien hay; NO evita que a alguien le bloqueen su cuenta a proposito, que sigue
  // dependiendo solo del correo.
  ip: string;
  // Opcional: sin ella se entra a la primera empresa disponible y el usuario cambia
  // despues con switch-tenant, sin pedirle que elija antes de saber que existe.
  tenantSlug?: string;
}
