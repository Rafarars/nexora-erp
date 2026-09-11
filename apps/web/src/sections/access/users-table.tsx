'use client';

import { useActionState, useState } from 'react';
import { assignRole, createUser, revokeRole } from '@/app/(app)/usuarios/actions';
import { emptyState } from '@/shared/forms/form-state';
import { Field, FormError, SubmitButton } from './field';
import { SlideOver } from './slide-over';
import type { FormState } from '@/shared/forms/form-state';
import type { Person } from '@/modules/access/domain/person';
import type { Role } from '@/modules/access/domain/role';

export function UsersTable({
  people,
  roles,
  canCreate,
  canAssign,
}: {
  people: Person[];
  roles: Role[];
  canCreate: boolean;
  canAssign: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Al guardar bien se cierra el panel; si fallo, se queda abierto con el error.
  const [createState, create, creating] = useActionState(
    async (previous: FormState, form: FormData) => {
      const result = await createUser(previous, form);

      if (result.done) setOpen(false);

      return result;
    },
    emptyState,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Usuarios</h1>
          <p className="text-muted mt-1 text-sm">Las personas que trabajan en esta empresa.</p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="new-user"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nueva persona
          </button>
        ) : null}
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="users-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Persona</th>
              <th className="px-4 py-2 font-medium">Roles</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {canAssign ? <th className="px-4 py-2 font-medium">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <PersonRow key={person.userId} person={person} roles={roles} canAssign={canAssign} />
            ))}

            {people.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted px-4 py-6 text-center" data-testid="users-empty">
                  Todavía no hay nadie en esta empresa.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver title="Nueva persona" open={open} onClose={() => setOpen(false)} testId="user-panel">
        <form action={create} className="space-y-4">
          <Field label="Nombre" name="name" testId="user-name" />
          <Field label="Correo" name="email" type="email" testId="user-email" />
          <Field label="Contraseña" name="password" type="password" testId="user-password" />

          {roles.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Roles</legend>
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={role.id}
                    data-testid={`user-role-${role.id}`}
                  />
                  {role.name}
                </label>
              ))}
            </fieldset>
          ) : null}

          <FormError message={createState.error} testId="user-error" />
          <SubmitButton pending={creating} testId="user-submit">
            Dar de alta
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

function PersonRow({
  person,
  roles,
  canAssign,
}: {
  person: Person;
  roles: Role[];
  canAssign: boolean;
}) {
  const [assignState, assign, assigning] = useActionState(assignRole, emptyState);
  const [, revoke, revoking] = useActionState(revokeRole, emptyState);

  const available = roles.filter((role) => !person.roles.includes(role.name));

  return (
    <tr className="border-line border-t align-top" data-testid={`user-row-${person.email}`}>
      <td className="px-4 py-3">
        <p className="font-medium">{person.name}</p>
        <p className="text-muted">{person.email}</p>
      </td>

      <td className="px-4 py-3" data-testid={`user-roles-${person.email}`}>
        {person.roles.length === 0 ? (
          <span className="text-muted">Sin roles</span>
        ) : (
          <ul className="space-y-1">
            {person.roles.map((role) => (
              <li key={role} className="flex items-center gap-2">
                {role}
                {canAssign ? (
                  <form action={revoke}>
                    <input type="hidden" name="userId" value={person.userId} />
                    <input
                      type="hidden"
                      name="roleId"
                      value={roles.find((candidate) => candidate.name === role)?.id ?? ''}
                    />
                    <button
                      type="submit"
                      disabled={revoking}
                      data-testid={`revoke-${person.email}-${role}`}
                      className="text-muted text-xs underline"
                    >
                      quitar
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className="px-4 py-3">
        {person.membershipActive ? (
          <span className="text-emerald-600">Activo</span>
        ) : (
          <span className="text-muted">Revocado</span>
        )}
      </td>

      {canAssign ? (
        <td className="px-4 py-3">
          {available.length > 0 ? (
            <form action={assign} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={person.userId} />
              <select
                name="roleId"
                data-testid={`assign-role-${person.email}`}
                className="border-line bg-background rounded-md border px-2 py-1 text-xs"
              >
                {available.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={assigning}
                data-testid={`assign-submit-${person.email}`}
                className="border-line rounded-md border px-2 py-1 text-xs"
              >
                Asignar
              </button>
            </form>
          ) : (
            <span className="text-muted text-xs">Todos asignados</span>
          )}
          <FormError message={assignState.error} testId={`assign-error-${person.email}`} />
        </td>
      ) : null}
    </tr>
  );
}
