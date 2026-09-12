import { UsersTable } from '@/sections/access/users-table';
import { can } from '@/modules/access/domain/session';
import { accessApi } from '@/shared/session/access-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'access.users.search')) {
    return (
      <p className="text-muted text-sm" data-testid="users-forbidden">
        Tu rol no tiene permiso para ver los usuarios de esta empresa.
      </p>
    );
  }

  const people = await accessApi().searchUsers(token);
  // Los roles hacen falta para asignar; sin permiso para verlos, la tabla los omite.
  const roles = can(session, 'access.roles.search') ? await accessApi().searchRoles(token) : [];

  return (
    <UsersTable
      people={people}
      roles={roles}
      currentUserId={session.userId}
      canCreate={can(session, 'access.users.create')}
      canUpdate={can(session, 'access.users.update')}
      canDeactivate={can(session, 'access.users.deactivate')}
    />
  );
}
