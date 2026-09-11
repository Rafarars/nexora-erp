import type { Person } from './person';
import type { Permission, Role } from './role';
import type { Session } from './session';

// El puerto que usa la interfaz. Las pruebas le enchufan un doble y no hace falta
// levantar la API para comprobar que una pantalla hace lo que debe.
export interface AccessApi {
  login(email: string, password: string): Promise<{ session: Session; token: string }>;
  switchTenant(token: string, tenantId: string): Promise<{ session: Session; token: string }>;
  // Quien soy ahora, sin reemitir el token.
  me(token: string): Promise<Session>;
  updateProfile(token: string, name: string): Promise<void>;
  changePassword(token: string, current: string, next: string): Promise<void>;
  searchUsers(token: string): Promise<Person[]>;
  createUser(
    token: string,
    person: { email: string; password: string; name: string; roleIds: string[] },
  ): Promise<void>;
  searchRoles(token: string): Promise<Role[]>;
  searchPermissions(token: string): Promise<Permission[]>;
  createRole(token: string, role: { name: string; permissions: string[] }): Promise<void>;
  updateRole(
    token: string,
    roleId: string,
    role: { name: string; permissions: string[] },
  ): Promise<void>;
  assignRole(token: string, userId: string, roleId: string): Promise<void>;
  revokeRole(token: string, userId: string, roleId: string): Promise<void>;
}
