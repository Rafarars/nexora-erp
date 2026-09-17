'use client';

import { useActionState, useState } from 'react';
import { FormError, SubmitButton } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import type { CatalogRecord } from '@/modules/catalog/domain/catalog';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
}

export interface RowAction<T> {
  label: string;
  testId: string;
  action: Action;
  visible: (row: T) => boolean;
}

// El listado de un maestro del catalogo: tabla, menu Opciones por fila y un panel
// lateral que sirve para crear y para editar. Cada pantalla solo dice sus columnas y
// sus campos. `resource` prefija los data-testid: `category-row-Bebidas`.
export function CatalogTable<T extends CatalogRecord>({
  resource,
  title,
  description,
  newLabel,
  rows,
  columns,
  renderFields,
  save,
  changeStatus,
  extraActions = [],
  canCreate,
  canUpdate,
  canDeactivate,
  rowKey = (row) => row.name,
}: {
  resource: string;
  title: string;
  description: string;
  newLabel: string;
  rows: T[];
  columns: Column<T>[];
  renderFields: (row: T | null) => React.ReactNode;
  save: Action;
  changeStatus: Action;
  extraActions?: RowAction<T>[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  rowKey?: (row: T) => string;
}) {
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const hasOptions = canUpdate || canDeactivate || extraActions.length > 0;

  // Cerrar al guardar bien se decide dentro de la accion: si falla, el panel sigue
  // abierto con el error.
  const [saveState, saveAction, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await save(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const [statusState, statusAction] = useActionState(changeStatus, emptyState);

  // Las acciones extra comparten un estado que vive aqui y no dentro del menu: el menu se
  // cierra al enviar, y con el se perderia el error.
  const [extraState, extraAction] = useActionState(async (previous: FormState, form: FormData) => {
    const extra = extraActions.find((candidate) => candidate.testId === form.get('extra'));

    return extra ? extra.action(previous, form) : previous;
  }, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-muted mt-1 text-sm">{description}</p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid={`new-${resource}`}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {newLabel}
          </button>
        ) : null}
      </div>

      <FormError message={statusState.error} testId={`${resource}-status-error`} />
      <FormError message={extraState.error} testId={`${resource}-action-error`} />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid={`${resource}-table`}>
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              {columns.map((column) => (
                <th key={column.header} className="px-4 py-2 font-medium">
                  {column.header}
                </th>
              ))}
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);

              return (
                <tr key={row.id} className="border-line border-t align-top" data-testid={`${resource}-row-${key}`}>
                  <td className="text-muted px-4 py-3 font-mono text-xs" data-testid={`${resource}-code-${key}`}>
                    {row.code}
                  </td>
                  {columns.map((column) => (
                    <td key={column.header} className="px-4 py-3">
                      {column.cell(row)}
                    </td>
                  ))}
                  <td className="px-4 py-3" data-testid={`${resource}-status-${key}`}>
                    {row.isActive ? <span className="text-emerald-600">Activo</span> : <span className="text-muted">Inactivo</span>}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      <RowOptions testId={`${resource}-options-${key}`}>
                        {(close) => (
                          <>
                            {canUpdate ? (
                              <MenuButton
                                testId={`${resource}-edit-${key}`}
                                onClick={() => {
                                  close();
                                  setEditing(row);
                                }}
                              >
                                Editar
                              </MenuButton>
                            ) : null}

                            {extraActions
                              .filter((extra) => extra.visible(row))
                              .map((extra) => (
                                <form key={extra.testId} action={extraAction} onSubmit={close}>
                                  <input type="hidden" name="id" value={row.id} />
                                  <input type="hidden" name="extra" value={extra.testId} />
                                  <MenuButton type="submit" testId={`${resource}-${extra.testId}-${key}`}>
                                    {extra.label}
                                  </MenuButton>
                                </form>
                              ))}

                            {canDeactivate ? (
                              <form action={statusAction} onSubmit={close}>
                                <input type="hidden" name="id" value={row.id} />
                                <input type="hidden" name="active" value={String(!row.isActive)} />
                                <MenuButton type="submit" testId={`${resource}-toggle-status-${key}`}>
                                  {row.isActive ? 'Desactivar' : 'Reactivar'}
                                </MenuButton>
                              </form>
                            ) : null}
                          </>
                        )}
                      </RowOptions>
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} className="text-muted px-4 py-6 text-center" data-testid={`${resource}-empty`}>
                  Todavía no hay registros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar: ${editing.name}` : newLabel}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId={`${resource}-panel`}
      >
        {/* La `key` rehace el formulario al cambiar de registro: sin ella quedarian los
            valores del anterior en los campos no controlados. */}
        <form onSubmit={submitKeepingValues(saveAction)} className="space-y-4" key={editing?.id ?? 'new'}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          {renderFields(editing)}
          <FormError message={saveState.error} testId={`${resource}-error`} />
          <SubmitButton pending={saving} testId={`${resource}-submit`}>
            Guardar
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

function MenuButton({
  children,
  testId,
  type = 'button',
  onClick,
}: {
  children: React.ReactNode;
  testId: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      role="menuitem"
      onClick={onClick}
      data-testid={testId}
      className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
    >
      {children}
    </button>
  );
}
