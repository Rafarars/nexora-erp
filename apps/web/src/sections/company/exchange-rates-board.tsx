'use client';

import { useActionState, useState } from 'react';
import { changeExchangeRateStatus, recordExchangeRate } from '@/app/(app)/administracion/tasas/actions';
import { Field, FormError, SubmitButton } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { RATE_LIST_LIMIT, RATE_TYPE_LABELS, formatRate } from '@/modules/company/domain/company';
import type { Currency, ExchangeRate, ExchangeRateBoard, RateFilter } from '@/modules/company/domain/company';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { Select } from './select';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';

const keyOf = (rate: ExchangeRate) => `${rate.currency}-${rate.type}-${rate.rateDate}`;

// Las tasas de la empresa: la vigente para los documentos de hoy, el listado con sus filtros y un
// panel lateral que carga una tasa nueva o corrige la de esa moneda, fecha y tipo.
export function ExchangeRatesBoard({
  board,
  error,
  filter,
  currencies,
  today,
  canRecord,
  canDeactivate,
}: {
  board: ExchangeRateBoard | null;
  error: string | null;
  filter: Required<RateFilter>;
  currencies: Currency[];
  today: string;
  canRecord: boolean;
  canDeactivate: boolean;
}) {
  const [editing, setEditing] = useState<ExchangeRate | null>(null);
  const [creating, setCreating] = useState(false);
  const hasOptions = canRecord || canDeactivate;

  const [saveState, saveAction, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await recordExchangeRate(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const [statusState, statusAction] = useActionState(changeExchangeRateStatus, emptyState);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Tasas de cambio</h2>
          <p className="text-muted mt-1 text-sm">
            Bolívares por 1 unidad de cada moneda. Un documento usa la tasa de su fecha o la última anterior, nunca una
            posterior. Los ya emitidos conservan la que usaron.
          </p>
        </div>

        {canRecord ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-rate"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Cargar tasa
          </button>
        ) : null}
      </div>

      {board ? (
        <div className="border-line rounded-lg border p-4" data-testid="rates-current">
          <p className="text-muted text-xs uppercase tracking-wide">
            Vigentes el {board.date} · {RATE_TYPE_LABELS[board.rateType]}
          </p>
          <ul className="mt-3 flex flex-wrap gap-6">
            {board.current.map((current) => (
              <li key={current.currency} data-testid={`rate-current-${current.currency}`}>
                <span className="text-muted text-sm">{current.name}</span>
                <span className="block text-lg font-semibold">{current.rate === null ? 'Sin tasa' : `${formatRate(current.rate)} Bs.`}</span>
                {current.rateDate && current.rateDate !== board.date ? <span className="text-muted text-xs">del {current.rateDate}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="rates-filter">
        <FilterSelect name="moneda" label="Moneda" value={filter.currency} options={currencies.map((currency) => [currency.code, currency.code])} all="Todas" />
        <FilterSelect name="tipo" label="Tipo" value={filter.type} options={Object.entries(RATE_TYPE_LABELS)} all="Todos" />
        {[
          ['desde', 'Desde', filter.from],
          ['hasta', 'Hasta', filter.to],
        ].map(([name, label, value]) => (
          <div key={name} className="space-y-1.5">
            <label htmlFor={`rates-${name}`} className="text-sm font-medium">
              {label}
            </label>
            <input id={`rates-${name}`} name={name} type="date" defaultValue={value} data-testid={`rates-${name}`} className="border-line rounded-md border bg-transparent px-3 py-2 text-sm" />
          </div>
        ))}
        <button type="submit" data-testid="rates-filter-submit" className="border-line rounded-md border px-3 py-2 text-sm">
          Ver
        </button>
      </form>

      <FormError message={error} testId="rates-error" />
      <FormError message={statusState.error} testId="rate-status-error" />

      {board ? (
        <div className="border-line overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="rate-table">
            <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Moneda</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 text-right font-medium">Tasa</th>
                <th className="px-4 py-2 font-medium">Fuente</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
              </tr>
            </thead>
            <tbody>
              {board.rates.map((rate) => {
                const key = keyOf(rate);

                return (
                  <tr key={rate.id} className="border-line border-t" data-testid={`rate-row-${key}`}>
                    <td className="px-4 py-3">{rate.rateDate}</td>
                    <td className="px-4 py-3 font-medium">{rate.currency}</td>
                    <td className="px-4 py-3">{RATE_TYPE_LABELS[rate.type]}</td>
                    <td className="px-4 py-3 text-right tabular-nums" data-testid={`rate-value-${key}`}>
                      {formatRate(rate.rate)}
                    </td>
                    <td className="text-muted px-4 py-3">{rate.source ?? '—'}</td>
                    <td className="px-4 py-3" data-testid={`rate-status-${key}`}>
                      {rate.isActive ? <span className="text-emerald-600">Activa</span> : <span className="text-muted">Inactiva</span>}
                    </td>
                    {hasOptions ? (
                      <td className="px-4 py-3 text-right">
                        <RowOptions testId={`rate-options-${key}`}>
                          {(close) => (
                            <>
                              {canRecord ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  data-testid={`rate-edit-${key}`}
                                  onClick={() => {
                                    close();
                                    setEditing(rate);
                                  }}
                                  className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
                                >
                                  Corregir
                                </button>
                              ) : null}
                              {canDeactivate ? (
                                <form action={statusAction} onSubmit={close}>
                                  <input type="hidden" name="id" value={rate.id} />
                                  <input type="hidden" name="active" value={String(!rate.isActive)} />
                                  <button type="submit" role="menuitem" data-testid={`rate-toggle-status-${key}`} className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm">
                                    {rate.isActive ? 'Desactivar' : 'Reactivar'}
                                  </button>
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

              {board.rates.length === 0 ? (
                <tr>
                  <td colSpan={hasOptions ? 7 : 6} className="text-muted px-4 py-6 text-center" data-testid="rate-empty">
                    No hay tasas cargadas con esos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {board && board.rates.length >= RATE_LIST_LIMIT ? (
        <p className="text-muted text-xs" data-testid="rate-limit">
          Se muestran las {RATE_LIST_LIMIT} más recientes: usa los filtros para ver las anteriores.
        </p>
      ) : null}

      <SlideOver
        title={editing ? `Corregir: ${editing.currency} del ${editing.rateDate}` : 'Cargar tasa'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="rate-panel"
      >
        {/* La `key` rehace el formulario al cambiar de tasa: sin ella quedarian los valores de la anterior. */}
        <form onSubmit={submitKeepingValues(saveAction)} className="space-y-4" key={editing?.id ?? 'new'}>
          {editing ? (
            <>
              <input type="hidden" name="currency" value={editing.currency} />
              <input type="hidden" name="rateDate" value={editing.rateDate} />
              <input type="hidden" name="type" value={editing.type} />
              <p className="text-muted text-sm">
                {RATE_TYPE_LABELS[editing.type]}. Guardarla la deja activa.
              </p>
            </>
          ) : (
            <>
              <Select label="Moneda" name="currency" testId="rate-currency" defaultValue={currencies[0]?.code ?? ''}>
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.name} ({currency.code})
                  </option>
                ))}
              </Select>
              <Field label="Fecha" name="rateDate" type="date" testId="rate-date" defaultValue={board?.date ?? today} autoComplete="off" />
              <Select label="Tipo" name="type" testId="rate-type" defaultValue={board?.rateType ?? 'legal'}>
                {Object.entries(RATE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <p className="text-muted text-sm">Si ya hay una tasa de esa moneda, fecha y tipo, se corrige.</p>
            </>
          )}
          {/* Texto y no number: el campo number del navegador no acepta la coma decimal. */}
          <Field label="Bolívares por 1 unidad" name="rate" testId="rate-value" defaultValue={editing ? formatRate(editing.rate) : ''} inputMode="decimal" autoComplete="off" />
          <Field label="Fuente" name="source" required={false} testId="rate-source" defaultValue={editing?.source ?? ''} autoComplete="off" />
          <FormError message={saveState.error} testId="rate-error" />
          <SubmitButton pending={saving} testId="rate-submit">
            Guardar
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

function FilterSelect({ name, label, value, options, all }: { name: string; label: string; value: string; options: [string, string][]; all: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`rates-${name}`} className="text-sm font-medium">
        {label}
      </label>
      <select id={`rates-${name}`} name={name} defaultValue={value} data-testid={`rates-${name}`} className="border-line bg-background rounded-md border px-3 py-2 text-sm">
        <option value="">{all}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
