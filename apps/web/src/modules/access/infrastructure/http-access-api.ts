import { AccessError } from '../domain/access-error';
import type { AccessErrorBody } from '../domain/access-error';
import type { AccessApi } from '../domain/access-api';
import type { Person } from '../domain/person';
import type { Permission, Role } from '../domain/role';
import type { Session } from '../domain/session';

// Lo que devuelven login y switch-tenant: la sesion anidada, con su token.
interface SessionPayload {
  token: string;
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string };
  permissions: string[];
  grantsAll: boolean;
  availableTenants: { id: string; name: string; slug: string }[];
}

// Lo que devuelve /auth/me: la misma informacion en plano y sin token. Son dos
// formas distintas y se traducen por separado en vez de forzarlas a una sola.
type MePayload = Session;

// El unico sitio que conoce la forma que devuelve la API. Traduce a los tipos del
// dominio; el resto de la aplicacion no sabe como se llaman los campos del JSON.
export class HttpAccessApi implements AccessApi {
  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string) {
    return this.toSession(
      await this.request<SessionPayload>('POST', '/api/v1/auth/login', { email, password }),
    );
  }

  async switchTenant(token: string, tenantId: string) {
    return this.toSession(
      await this.request<SessionPayload>('POST', '/api/v1/auth/switch-tenant', { tenantId }, token),
    );
  }

  async me(token: string): Promise<Session> {
    return this.request<MePayload>('GET', '/api/v1/auth/me', undefined, token);
  }

  async updateProfile(token: string, name: string): Promise<void> {
    await this.request('PUT', '/api/v1/auth/profile', { name }, token);
  }

  async changePassword(token: string, current: string, next: string): Promise<void> {
    await this.request('PUT', '/api/v1/auth/password', { current, next }, token);
  }

  async changeEmail(token: string, current: string, email: string): Promise<void> {
    await this.request('PUT', '/api/v1/auth/email', { current, email }, token);
  }

  async searchUsers(token: string): Promise<Person[]> {
    const { users } = await this.request<{ users: Person[] }>('GET', '/api/v1/users', undefined, token);

    return users;
  }

  async createUser(
    token: string,
    person: { email: string; password: string; name: string; roleIds: string[] },
  ): Promise<void> {
    await this.request('POST', '/api/v1/users', person, token);
  }

  async updateUser(
    token: string,
    userId: string,
    person: { name: string; roleIds: string[] },
  ): Promise<void> {
    await this.request('PUT', `/api/v1/users/${userId}`, person, token);
  }

  async changeUserStatus(token: string, userId: string, active: boolean): Promise<void> {
    await this.request('PUT', `/api/v1/users/${userId}/status`, { active }, token);
  }

  async searchRoles(token: string): Promise<Role[]> {
    const { roles } = await this.request<{ roles: Role[] }>('GET', '/api/v1/roles', undefined, token);

    return roles;
  }

  async searchPermissions(token: string): Promise<Permission[]> {
    const { permissions } = await this.request<{ permissions: Permission[] }>(
      'GET',
      '/api/v1/permissions',
      undefined,
      token,
    );

    return permissions;
  }

  async createRole(token: string, role: { name: string; permissions: string[] }): Promise<void> {
    await this.request('POST', '/api/v1/roles', role, token);
  }

  async updateRole(
    token: string,
    roleId: string,
    role: { name: string; permissions: string[] },
  ): Promise<void> {
    await this.request('PUT', `/api/v1/roles/${roleId}`, role, token);
  }

  async assignRole(token: string, userId: string, roleId: string): Promise<void> {
    await this.request('POST', '/api/v1/roles/assignments', { userId, roleId }, token);
  }

  async revokeRole(token: string, userId: string, roleId: string): Promise<void> {
    await this.request('DELETE', '/api/v1/roles/assignments', { userId, roleId }, token);
  }

  private toSession(payload: SessionPayload): { session: Session; token: string } {
    return {
      token: payload.token,
      session: {
        userId: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        tenantId: payload.tenant.id,
        tenantName: payload.tenant.name,
        permissions: payload.permissions,
        grantsAll: payload.grantsAll,
        availableTenants: payload.availableTenants,
      },
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw AccessError.fromStatus(response.status, await errorBodyOf(response));
    }

    // 200 sin cuerpo: crear y borrar no devuelven nada.
    const text = await response.text();

    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
  }
}

async function errorBodyOf(response: Response): Promise<AccessErrorBody> {
  try {
    const body = await response.json();

    return {
      message: String(body.message ?? ''),
      code: typeof body.error === 'string' ? body.error : '',
      fields: Array.isArray(body.fields) ? body.fields.map(String) : [],
    };
  } catch {
    return {};
  }
}
