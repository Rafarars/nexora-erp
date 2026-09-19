export interface RoleAssignerRequest {
  tenantId: string;
  // Quien hace el cambio: sin esto, esta ruta no podia saber que alguien se estaba
  // ascendiendo a si mismo.
  actorId: string;
  userId: string;
  roleId: string;
}
