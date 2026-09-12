export interface TenantUserResponse {
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  membershipActive: boolean;
  roles: string[];
  // Los identificadores hacen falta para marcar las casillas al editar.
  roleIds: string[];
}

export interface UserSearcherResponse {
  users: TenantUserResponse[];
}
