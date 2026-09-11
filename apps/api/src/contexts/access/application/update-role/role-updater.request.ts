export interface RoleUpdaterRequest {
  tenantId: string;
  roleId: string;
  name: string;
  permissions: string[];
}
