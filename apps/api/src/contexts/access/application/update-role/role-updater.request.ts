export interface RoleUpdaterRequest {
  tenantId: string;
  // Quien edita: un rol es acceso repartido, y nadie reparte mas de lo que tiene.
  actorId: string;
  roleId: string;
  name: string;
  permissions: string[];
}
