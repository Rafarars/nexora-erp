export interface RoleRevokerRequest {
  tenantId: string;
  // Quien hace el cambio: sin esto, esta ruta no podia saber que alguien se estaba
  // quitando a si mismo la administracion.
  actorId: string;
  userId: string;
  roleId: string;
}
