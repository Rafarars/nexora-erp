'use client';

import { useActionState, useState } from 'react';
import {
  changeUserStatus,
  createUser,
  updateUser,
} from '@/app/(app)/administracion/usuarios/actions';
import { Field, FormError, SubmitButton } from './field';
import { RowOptions } from './row-options';
import { SlideOver } from './slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import type { Person } from '@/modules/access/domain/person';
import type { Role } from '@/modules/access/domain/role';

export function UsersTable({
  people,
  roles,
  currentUserId,
  canCreate,
  canUpdate,
  canDeactivate,
}: {
  people: Person[];
  roles: Role[];
  currentUserId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const hasOptions = canUpdate || canDeactivate;

  const [createState, create, saving] = useActionState(
    async (previous: FormState, form: FormData) => {
      const result = await createUser(previous, form);
      if (result.done) setCreating(false);
      return result;
    },
    emptyState,
  );

  const [updateState, update, updating] = useActionState(
    async (previous: FormState, form: FormData) => {
      const result = await updateUser(previous, form);
      if (result.done) setEditing(null);
      return result;
    },
    emptyState,
  );

  const [statusState, changeStatus] = useActionState(changeUserStatus, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Usuarios</h2>
          <p className="text-muted mt-1 text-sm">Las personas que trabajan en esta empresa.</p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-user"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nueva persona
          </button>
        ) : null}
      </div>

      <FormError message={statusState.error} testId="status-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="users-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Persona</th>
              <th className="px-4 py-2 font-medium">Roles</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr
                key={person.userId}
                className="border-line border-t align-top"
                data-testid={`user-row-${person.email}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{person.name}</p>
                  <p className="text-muted">{person.email}</p>
                </td>
                <td className="px-4 py-3" data-testid={`user-roles-${person.email}`}>
                  {person.roles.length === 0 ? (
                    <span className="text-muted">Sin roles</span>
                  ) : (
                    person.roles.join(', ')
                  )}
                </td>
                <td className="px-4 py-3" data-testid={`user-status-${person.email}`}>
                  {person.membershipActive ? (
                    <span className="text-emerald-600">Activo</span>
                  ) : (
                    <span className="text-muted">Inactivo</span>
                  )}
                </td>
                {hasOptions ? (
                  <td className="px-4 py-3 text-right">
                    <RowOptions testId={`user-options-${person.email}`}>
                      {(close) => (
                        <>
                          {canUpdate ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                close();
                                setEditing(person);
                              }}
                              data-testid={`user-edit-${person.email}`}
                              className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
                            >
                              Editar
                            </button>
                          ) : null}

                          {/* Desactivarse a uno mismo dejaria la empresa sin quien la
                              gestione; la API lo rechaza y aqui ni se ofrece. */}
                          {canDeactivate && person.userId !== currentUserId ? (
                            <form action={changeStatus} onSubmit={close}>
                              <input type="hidden" name="userId" value={person.userId} />
                              <input
                                type="hidden"
                                name="active"
                                value={String(!person.membershipActive)}
                              />
                              <button
                                type="submit"
                                role="menuitem"
                                data-testid={`user-toggle-status-${person.email}`}
                                className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
                              >
                                {person.membershipActive
                                  ? 'Desactivar en esta empresa'
                                  : 'Reactivar en esta empresa'}
                              </button>
                            </form>
                          ) : null}
                        </>
                      )}
                    </RowOptions>
                  </td>
                ) : null}
              </tr>
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

      <SlideOver title="Nueva persona" open={creating} onClose={() => setCreating(false)} testId="user-panel">
        <form action={create} className="space-y-4">
          <Field label="Nombre" name="name" testId="user-name" autoComplete="off" />
          <Field label="Correo" name="email" type="email" testId="user-email" autoComplete="off" />
          <Field
            label="Contraseña"
            name="password"
            type="password"
            testId="user-password"
            autoComplete="new-password"
          />
          <RoleCheckboxes roles={roles} checked={[]} prefix="user-role" />
          <FormError message={createState.error} testId="user-error" />
          <SubmitButton pending={saving} testId="user-submit">
            Dar de alta
          </SubmitButton>
        </form>
      </SlideOver>

      <SlideOver
        title={editing ? `Editar: ${editing.name}` : 'Editar'}
        open={editing !== null}
        onClose={() => setEditing(null)}
        testId="user-edit-panel"
      >
        {editing ? (
          <form action={update} className="space-y-4" key={editing.userId}>
            <input type="hidden" name="userId" value={editing.userId} />
            <Field label="Nombre" name="name" testId="edit-name" defaultValue={editing.name} />

            <div className="space-y-1.5">
              <label htmlFor="edit-email" className="text-sm font-medium">
                Correo
              </label>
              <input
                id="edit-email"
                value={editing.email}
                disabled
                data-testid="edit-email"
                className="border-line text-muted w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
              {/* La cuenta es la misma en todas sus empresas: correo y contraseña los
                  cambia solo la propia persona, o se abriria la puerta a las demas. */}
              <p className="text-muted text-xs">
                El correo y la contraseña solo los puede cambiar la propia persona desde su perfil.
              </p>
            </div>

            <RoleCheckboxes roles={roles} checked={editing.roleIds} prefix="edit-role" />
            <FormError message={updateState.error} testId="edit-error" />
            <SubmitButton pending={updating} testId="edit-submit">
              Guardar cambios
            </SubmitButton>
          </form>
        ) : null}
      </SlideOver>
    </section>
  );
}

function RoleCheckboxes({
  roles,
  checked,
  prefix,
}: {
  roles: Role[];
  checked: string[];
  prefix: string;
}) {
  if (roles.length === 0) return null;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Roles</legend>
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="roleIds"
            value={role.id}
            defaultChecked={checked.includes(role.id)}
            data-testid={`${prefix}-${role.name}`}
          />
          {role.name}
        </label>
      ))}
    </fieldset>
  );
}
