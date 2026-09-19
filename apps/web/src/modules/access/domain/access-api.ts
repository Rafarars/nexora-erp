import type { Person } from './person';
import type { Permission, Role } from './role';
import type { Session } from './session';

export interface IssuedSession {
  session: Session;
  token: string;
  expiresInSeconds: number;
}

// El puerto que usa la interfaz. Las pruebas le enchufan un doble y no hace falta
// levantar la API para comprobar que una pantalla hace lo que debe.
export interface AccessApi {
  // `expiresInSeconds` viene de la API: la vida de la sesion la decide quien firma el
  // token, no un numero repetido aqui.
  login(email: string, password: string): Promise<IssuedSession>;
  switchTenant(token: string, tenantId: string): Promise<IssuedSession>;
  // Quien soy ahora, sin reemitir el token.
  me(token: string): Promise<Session>;
  updateProfile(token: string, name: string): Promise<void>;
  // Devuelve una sesion nueva: cambiar la contrasena cierra todas las abiertas, y sin
  // guardar esta, quien la cambia se echaria a si mismo.
  changePassword(token: string, current: string, next: string): Promise<IssuedSession>;
  changeEmail(token: string, current: string, email: string): Promise<void>;
  searchUsers(token: string): Promise<Person[]>;
  createUser(
    token: string,
    person: { email: string; password: string; name: string; roleIds: string[] },
  ): Promise<void>;
  updateUser(token: string, userId: string, person: { name: string; roleIds: string[] }): Promise<void>;
  changeUserStatus(token: string, userId: string, active: boolean): Promise<void>;
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
