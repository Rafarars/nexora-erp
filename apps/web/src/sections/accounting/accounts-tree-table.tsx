'use client';

import { useActionState, useMemo, useState } from 'react';
import type { FormState } from '@/shared/forms/form-state';
import { useEditingDraft } from '@/shared/forms/use-editing-draft';
import { changeAccountStatus, saveAccount } from '@/app/(app)/contabilidad/actions';
import { ACCOUNT_TYPE_LABELS, type AccountRow } from '@/modules/accounting/domain/accounting';

const emptyState: FormState = { error: null, done: false };

export function AccountsTreeTable({
  accounts,
  canCreate,
  canUpdate,
  canDeactivate,
}: {
  accounts: AccountRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  const { editing, setEditing, draftKey } = useEditingDraft(accounts);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [saveState, saveAction, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveAccount(previous, form);
    if (result.done) {
      setEditing(null);
      setCreating(false);
    }
    return result;
  }, emptyState);

  const [statusState, statusAction, updatingStatus] = useActionState(changeAccountStatus, emptyState);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term);
    });
  }, [accounts, search, typeFilter]);

  // Posibles cuentas padre (solo las que no aceptan asientos o cuentas de grupo)
  const groupAccounts = useMemo(() => {
    return accounts.filter((a) => !a.acceptsEntries && a.isActive);
  }, [accounts]);

  return (
    <div className="space-y-4" data-testid="accounts-section">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-line bg-background focus:ring-accent w-full max-w-xs rounded-md border px-3 py-1.5 text-sm"
            data-testid="accounts-search-input"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border-line bg-background focus:ring-accent rounded-md border px-3 py-1.5 text-sm"
            data-testid="accounts-type-filter"
          >
            <option value="all">Todos los tipos</option>
            <option value="asset">Activo</option>
            <option value="liability">Pasivo</option>
            <option value="equity">Patrimonio</option>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            data-testid="btn-new-account"
          >
            Nueva cuenta
          </button>
        ) : null}
      </div>

      {saveState.error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" data-testid="accounts-error">
          {saveState.error}
        </div>
      ) : null}

      {statusState.error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" data-testid="accounts-status-error">
          {statusState.error}
        </div>
      ) : null}

      {/* Tabla del plan de cuentas */}
      <div className="border-line overflow-hidden rounded-md border">
        <table className="w-full text-left text-sm" data-testid="accounts-table">
          <thead className="bg-muted/50 border-line border-b text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Movimientos</th>
              <th className="px-4 py-3">Estado</th>
              {canUpdate || canDeactivate ? <th className="px-4 py-3 text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-6 text-center">
                  No se encontraron cuentas contables.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((acc) => {
                const indentLevel = Math.max(0, acc.code.split('.').length - 1);
                return (
                  <tr
                    key={acc.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`account-row-${acc.code}`}
                  >
                    <td className="px-4 py-2.5 font-mono font-medium" data-testid="account-code">
                      <span style={{ paddingLeft: `${indentLevel * 1.25}rem` }}>
                        {acc.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" data-testid="account-name">
                      <span className={acc.acceptsEntries ? 'text-foreground' : 'font-semibold text-foreground'}>
                        {acc.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" data-testid="account-type">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">
                        {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" data-testid="account-accepts-entries">
                      {acc.acceptsEntries ? (
                        <span className="inline-flex items-center text-xs text-green-700 dark:text-green-400">
                          Acepta asientos
                        </span>
                      ) : (
                        <span className="text-muted inline-flex items-center text-xs font-medium">
                          Grupo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" data-testid="account-status">
                      {acc.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Inactiva
                        </span>
                      )}
                    </td>
                    {canUpdate || canDeactivate ? (
                      <td className="px-4 py-2.5 text-right space-x-2">
                        {canUpdate ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCreating(false);
                              setEditing(acc);
                            }}
                            className="text-accent hover:underline text-xs font-medium"
                            data-testid={`btn-edit-account-${acc.code}`}
                          >
                            Editar
                          </button>
                        ) : null}

                        {canDeactivate ? (
                          <form action={statusAction} className="inline-block">
                            <input type="hidden" name="id" value={acc.id} />
                            <input type="hidden" name="isActive" value={acc.isActive ? 'false' : 'true'} />
                            <button
                              type="submit"
                              disabled={updatingStatus}
                              className="text-muted hover:text-foreground text-xs"
                              data-testid={`btn-toggle-status-${acc.code}`}
                            >
                              {acc.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </form>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Formulario Modal / Drawer para Crear o Editar */}
      {creating || editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="border-line bg-background w-full max-w-lg rounded-lg border p-6 shadow-xl" data-testid="account-form-modal">
            <h3 className="text-base font-semibold">
              {creating ? 'Nueva cuenta contable' : `Editar cuenta: ${editing?.code}`}
            </h3>
            <p className="text-muted mt-1 text-sm">
              {creating
                ? 'Agrega una nueva cuenta al plan. Las cuentas de grupo solo agrupan y no reciben asientos directos.'
                : 'Modifica el nombre o si la cuenta admite asientos directos.'}
            </p>

            <form action={saveAction} key={creating ? 'new' : draftKey()} className="mt-4 space-y-4" data-testid="account-form">
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

              {creating ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Código</label>
                    <input
                      type="text"
                      name="code"
                      required
                      placeholder="Ej: 1.1.01.002"
                      className="border-line bg-background focus:ring-accent w-full rounded-md border px-3 py-1.5 text-sm"
                      data-testid="input-account-code"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Tipo</label>
                    <select
                      name="type"
                      required
                      className="border-line bg-background focus:ring-accent w-full rounded-md border px-3 py-1.5 text-sm"
                      data-testid="select-account-type"
                    >
                      <option value="asset">Activo</option>
                      <option value="liability">Pasivo</option>
                      <option value="equity">Patrimonio</option>
                      <option value="income">Ingreso</option>
                      <option value="expense">Gasto</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Cuenta padre (opcional)</label>
                    <select
                      name="parentId"
                      className="border-line bg-background focus:ring-accent w-full rounded-md border px-3 py-1.5 text-sm"
                      data-testid="select-account-parent"
                    >
                      <option value="">Ninguna (cuenta principal)</option>
                      {groupAccounts.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium">Nombre</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editing?.name ?? ''}
                  required
                  placeholder="Nombre de la cuenta"
                  className="border-line bg-background focus:ring-accent w-full rounded-md border px-3 py-1.5 text-sm"
                  data-testid="input-account-name"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="acceptsEntries"
                  name="acceptsEntries"
                  value="true"
                  defaultChecked={creating ? true : editing?.acceptsEntries}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                  data-testid="input-account-accepts-entries"
                />
                <label htmlFor="acceptsEntries" className="text-xs font-medium">
                  ¿Acepta asientos directos? (Cuenta de detalle/hoja)
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditing(null);
                  }}
                  className="border-line hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
                  data-testid="btn-cancel-account"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-md px-4 py-1.5 text-sm font-medium"
                  data-testid="btn-save-account"
                >
                  {saving ? 'Guardando...' : 'Guardar cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
