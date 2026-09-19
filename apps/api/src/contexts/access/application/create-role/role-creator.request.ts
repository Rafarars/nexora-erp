export interface RoleCreatorRequest {
  tenantId: string;
  // Quien lo crea: un rol es acceso repartido, y nadie reparte mas de lo que tiene.
  actorId: string;
  name: string;
  permissions: string[];
}
