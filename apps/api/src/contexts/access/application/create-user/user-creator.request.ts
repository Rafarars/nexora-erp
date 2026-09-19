export interface UserCreatorRequest {
  tenantId: string;
  // Quien da el alta: nadie crea una cuenta con mas acceso del que tiene.
  actorId: string;
  email: string;
  password: string;
  name: string;
  roleIds?: string[];
}
