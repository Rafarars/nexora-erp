export interface UserCreatorRequest {
  tenantId: string;
  email: string;
  password: string;
  name: string;
  roleIds?: string[];
}
