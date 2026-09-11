'use client';

import { useActionState, useState } from 'react';
import { saveRole } from '@/app/(app)/roles/actions';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { Field, FormError, SubmitButton } from './field';
import { SlideOver } from './slide-over';
import { groupByModule } from '@/modules/access/domain/role';
import type { Permission, Role } from '@/modules/access/domain/role';

export function RolesBoard({
  roles,
  permissions,
  canCreate,
  canUpdate,
}: {
  roles: Role[];
  permissions: Permission[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  // Cerrar al guardar bien se decide DENTRO de la accion, no en un efecto que
  // reaccione al resultado: si falla, el panel se queda abierto con el error.
  const [state, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveRole(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const open = creating || editing !== null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Roles</h1>
          <p className="text-muted mt-1 text-sm">
            Marca lo que puede hacer cada rol. El cambio afecta de inmediato a quien lo tenga.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-role"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nuevo rol
          </button>
        ) : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2" data-testid="roles-list">
        {roles.map((role) => (
          <li key={role.id} className="border-line rounded-lg border p-4" data-testid={`role-${role.name}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{role.name}</p>
                <p className="text-muted mt-1 text-sm">
                  {role.grantsAll
                    ? 'Concede todos los permisos de la empresa'
                    : `${role.permissions.length} permiso${role.permissions.length === 1 ? '' : 's'}`}
                </p>
              </div>

              {canUpdate && !role.grantsAll ? (
                <button
                  type="button"
                  onClick={() => setEditing(role)}
                  data-testid={`edit-role-${role.name}`}
                  className="border-line rounded-md border px-2 py-1 text-xs"
                >
                  Editar
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <SlideOver
        title={editing ? `Rol: ${editing.name}` : 'Nuevo rol'}
        open={open}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        testId="role-panel"
      >
        <form action={save} className="space-y-5">
          <input type="hidden" name="roleId" value={editing?.id ?? ''} />
          <Field label="Nombre" name="name" testId="role-name" defaultValue={editing?.name} />

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Permisos</legend>

            {[...groupByModule(permissions).entries()].map(([module, items]) => (
              <div key={module} className="space-y-2">
                <p className="text-muted text-xs uppercase tracking-wide">{module}</p>

                {items.map((permission) => (
                  <label key={permission.code} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="permissions"
                      value={permission.code}
                      defaultChecked={editing?.permissions.includes(permission.code)}
                      data-testid={`permission-${permission.code}`}
                      className="mt-1"
                    />
                    <span>
                      {permission.description}
                      <span className="text-muted block text-xs">{permission.code}</span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>

          <FormError message={state.error} testId="role-error" />
          <SubmitButton pending={saving} testId="role-submit">
            Guardar rol
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}
