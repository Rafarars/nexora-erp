import { RolesBoard } from '@/sections/access/roles-board';
import { can } from '@/modules/access/domain/session';
import { accessApi } from '@/shared/session/access-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'access.roles.search')) {
    return (
      <p className="text-muted text-sm" data-testid="roles-forbidden">
        Tu rol no tiene permiso para ver los roles de esta empresa.
      </p>
    );
  }

  const [roles, permissions] = await Promise.all([
    accessApi().searchRoles(token),
    accessApi().searchPermissions(token),
  ]);

  return (
    <RolesBoard
      roles={roles}
      permissions={permissions}
      canCreate={can(session, 'access.roles.create')}
      canUpdate={can(session, 'access.roles.update')}
    />
  );
}
