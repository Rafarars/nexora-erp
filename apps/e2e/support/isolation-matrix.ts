// Identificadores de Globex, sembrados por el seed. Acme no deberia poder ni verlos.
export const GLOBEX = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  adminRoleId: 'b0000000-0000-4000-8000-000000000001',
  betoUserId: 'c0000000-0000-4000-8000-000000000002',
};

export const ACME = {
  anaUserId: 'c0000000-0000-4000-8000-000000000001',
  viewerRoleId: 'a0000000-0000-4000-8000-000000000002',
};

export interface IsolationCase {
  // "METODO /ruta/con/:parametros" tal como la declara el controlador.
  route: string;
  title: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  body?: Record<string, unknown>;
}

// Cada endpoint que recibe un identificador, atacado con datos de Globex desde una
// sesion de Acme con TODOS los permisos. Si falla aqui, no es un permiso: es una fuga.
export const ISOLATION_CASES: IsolationCase[] = [
  {
    route: 'PUT /api/v1/users/:userId',
    title: 'edit a person of another tenant',
    method: 'put',
    path: `/api/v1/users/${GLOBEX.betoUserId}`,
    body: { name: 'Colado', roleIds: [] },
  },
  {
    route: 'PUT /api/v1/users/:userId/status',
    title: 'deactivate a person of another tenant',
    method: 'put',
    path: `/api/v1/users/${GLOBEX.betoUserId}/status`,
    body: { active: false },
  },
  {
    route: 'PUT /api/v1/roles/:roleId',
    title: 'rewrite a role of another tenant',
    method: 'put',
    path: `/api/v1/roles/${GLOBEX.adminRoleId}`,
    body: { name: 'Colado', permissions: [] },
  },
  {
    route: 'POST /api/v1/roles/assignments',
    title: 'grant a role of another tenant',
    method: 'post',
    path: '/api/v1/roles/assignments',
    body: { userId: ACME.anaUserId, roleId: GLOBEX.adminRoleId },
  },
  {
    route: 'DELETE /api/v1/roles/assignments',
    title: 'take a role away from a person of another tenant',
    method: 'delete',
    path: '/api/v1/roles/assignments',
    body: { userId: GLOBEX.betoUserId, roleId: GLOBEX.adminRoleId },
  },
  {
    route: 'POST /api/v1/users',
    title: 'create a person with a role of another tenant',
    method: 'post',
    path: '/api/v1/users',
    body: {
      email: 'colado-matriz@acme.com',
      password: 'a-long-password',
      name: 'Colado',
      roleIds: [GLOBEX.adminRoleId],
    },
  },
];
