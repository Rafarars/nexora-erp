export interface RoleResponse {
  id: string;
  name: string;
  grantsAll: boolean;
  permissions: string[];
}

export interface RoleSearcherResponse {
  roles: RoleResponse[];
}
