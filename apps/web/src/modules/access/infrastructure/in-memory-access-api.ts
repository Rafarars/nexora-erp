import { AccessError } from '../domain/access-error';
import type { AccessApi } from '../domain/access-api';
import type { Person } from '../domain/person';
import type { Permission, Role } from '../domain/role';
import type { Session } from '../domain/session';

// Doble para probar la logica de la interfaz sin levantar la API. Guarda lo que le
// piden para que una prueba compruebe QUE se llamo, no solo que no reviento.
export class InMemoryAccessApi implements AccessApi {
  readonly calls: { method: string; args: unknown[] }[] = [];

  constructor(
    private readonly data: {
      session?: Session;
      people?: Person[];
      roles?: Role[];
      permissions?: Permission[];
      failWith?: AccessError;
    } = {},
  ) {}

  async login(email: string, password: string) {
    return this.answer('login', [email, password], () => ({
      session: this.session(),
      token: 'a-token',
    }));
  }

  async switchTenant(token: string, tenantId: string) {
    return this.answer('switchTenant', [token, tenantId], () => ({
      session: { ...this.session(), tenantId },
      token: 'another-token',
    }));
  }

  async me(token: string): Promise<Session> {
    return this.answer('me', [token], () => this.session());
  }

  async searchUsers(token: string): Promise<Person[]> {
    return this.answer('searchUsers', [token], () => this.data.people ?? []);
  }

  async createUser(
    token: string,
    person: { email: string; password: string; name: string; roleIds: string[] },
  ): Promise<void> {
    this.answer('createUser', [token, person], () => undefined);
  }

  async searchRoles(token: string): Promise<Role[]> {
    return this.answer('searchRoles', [token], () => this.data.roles ?? []);
  }

  async searchPermissions(token: string): Promise<Permission[]> {
    return this.answer('searchPermissions', [token], () => this.data.permissions ?? []);
  }

  async createRole(token: string, role: { name: string; permissions: string[] }): Promise<void> {
    this.answer('createRole', [token, role], () => undefined);
  }

  async updateRole(
    token: string,
    roleId: string,
    role: { name: string; permissions: string[] },
  ): Promise<void> {
    this.answer('updateRole', [token, roleId, role], () => undefined);
  }

  async assignRole(token: string, userId: string, roleId: string): Promise<void> {
    this.answer('assignRole', [token, userId, roleId], () => undefined);
  }

  async revokeRole(token: string, userId: string, roleId: string): Promise<void> {
    this.answer('revokeRole', [token, userId, roleId], () => undefined);
  }

  calledWith(method: string): unknown[] | undefined {
    return this.calls.find((call) => call.method === method)?.args;
  }

  private answer<T>(method: string, args: unknown[], value: () => T): T {
    this.calls.push({ method, args });

    if (this.data.failWith) {
      throw this.data.failWith;
    }

    return value();
  }

  private session(): Session {
    if (!this.data.session) {
      throw new AccessError('Invalid credentials.', 'credentials');
    }

    return this.data.session;
  }
}
