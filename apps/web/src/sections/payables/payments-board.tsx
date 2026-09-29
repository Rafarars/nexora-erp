'use client';

import { useActionState, useState } from 'react';
import { changePayment, savePayment } from '@/app/(app)/cuentas-por-pagar/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import type { Supplier } from '@/modules/purchasing/domain/purchasing';
import { currencyOptions, formatRate, offersManualRate } from '@/modules/company/domain/company';
import { DocumentRate } from '@/sections/shared/document-rate';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentActions,
} from '@/modules/payables/domain/payables';
import type {
  PayableInvoice,
  PaymentMethod,
  SupplierPayment,
} from '@/modules/payables/domain/payables';
import type { CompanySettings, Currency } from '@/modules/company/domain/company';
import { Filter, Pager } from '@/sections/shared/filters';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';
import { useEditingDraft } from '@/shared/forms/use-editing-draft';

export interface PaymentSearch {
  q: string;
  supplierId: string;
  status: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function PaymentsBoard({
  payments,
  search,
  invoices,
  suppliers,
  currencies,
  settings,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  payments: SupplierPayment[];
  search: PaymentSearch;
  invoices: PayableInvoice[];
  suppliers: Supplier[];
  currencies: Currency[];
  settings: CompanySettings;
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const { editing, setEditing, draftKey } = useEditingDraft(payments);
  const [creating, setCreating] = useState(false);
  const hasOptions = canUpdate || canConfirm || canCancel;

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await savePayment(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changePayment, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Pagos</h2>
          <p className="text-muted mt-1 text-sm">
            Un borrador no toca ningún saldo. Confirmado, baja lo que se debe de sus facturas; anularlo se lo devuelve.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-payment"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nuevo pago
          </button>
        ) : null}
      </div>

      <PaymentFilters search={search} suppliers={suppliers} count={payments.length} />

      <FormError message={changeState.error} testId="payment-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="payments-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Forma de pago</th>
              <th className="px-4 py-2 font-medium">Facturas</th>
              <th className="px-4 py-2 text-right font-medium">Monto</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const actions = paymentActions(payment, canUpdate, canConfirm, canCancel);
              const offered = { edit: actions.canEdit, confirm: actions.canConfirm, cancel: actions.canCancel };

              return (
                <tr key={payment.id} className="border-line border-t align-top" data-testid={`payment-row-${payment.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{payment.code}</p>
                    <p className="text-muted text-xs">{payment.paymentDate}</p>
                  </td>
                  <td className="px-4 py-3">{payment.supplier.name}</td>
                  <td className="px-4 py-3">
                    <p>{PAYMENT_METHOD_LABELS[payment.method]}</p>
                    {payment.reference ? <p className="text-muted text-xs">{payment.reference}</p> : null}
                    {payment.isIssuePayment && payment.issueCreditNoteCode ? (
                      <p className="text-muted text-xs font-mono" data-testid={`payment-issue-note-${payment.code}`}>
                        Emisión de {payment.issueCreditNoteCode}
                      </p>
                    ) : null}
                    {!payment.isIssuePayment && payment.creditSourceCode ? (
                      <p className="text-muted text-xs font-mono" data-testid={`payment-credit-source-${payment.code}`}>
                        Nota de crédito {payment.creditSourceCode}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {payment.allocations.map((allocation) => (
                      <div key={allocation.invoiceId}>
                        <p>
                          <span className="font-mono">{allocation.invoiceCode}</span> {allocation.currency} {formatAmount(allocation.amount)}
                        </p>
                        {allocation.exchangeDifference !== null && allocation.exchangeDifference !== 0 ? (
                          <p className="text-muted" data-testid={`payment-difference-${payment.code}-${allocation.invoiceCode}`}>
                            Diferencial Bs. {formatAmount(allocation.exchangeDifference)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p data-testid={`payment-amount-${payment.code}`}>
                      {payment.currency} {formatAmount(payment.amount)}
                    </p>
                    <DocumentRate document={payment} bolivars={payment.amountVes} testId={`payment-rate-${payment.code}`} />
                  </td>
                  <td className="px-4 py-3" data-testid={`payment-status-${payment.code}`}>
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {Object.values(offered).some(Boolean) ? (
                        <RowOptions testId={`payment-options-${payment.code}`}>
                          {(close) => (
                            <>
                              {offered.edit ? (
                                <MenuButton
                                  testId={`payment-edit-${payment.code}`}
                                  onClick={() => {
                                    close();
                                    setEditing(payment);
                                  }}
                                >
                                  Editar
                                </MenuButton>
                              ) : null}
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={payment.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`payment-confirm-${payment.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={payment.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`payment-cancel-${payment.code}`}>
                                    Anular
                                  </MenuButton>
                                </form>
                              ) : null}
                            </>
                          )}
                        </RowOptions>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="payments-empty">
                  Ningún pago coincide con lo que buscas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar ${editing.code}` : 'Nuevo pago'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="payment-panel"
      >
        <form onSubmit={submitKeepingValues(save)} className="space-y-4" key={draftKey()}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <PaymentFields payment={editing} invoices={invoices} suppliers={suppliers} currencies={currencies} settings={settings} />
          <FormError message={saveState.error} testId="payment-error" />
          <SubmitButton pending={saving} testId="payment-submit">
            Guardar borrador
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

function PaymentFields({
  payment,
  invoices,
  suppliers,
  currencies,
  settings,
}: {
  payment: SupplierPayment | null;
  invoices: PayableInvoice[];
  suppliers: Supplier[];
  currencies: Currency[];
  settings: CompanySettings;
}) {
  const baseCurrency = settings.baseCurrency.code;
  const [supplierId, setSupplierId] = useState(payment?.supplier.id ?? '');
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? 'transfer');
  const [currency, setCurrency] = useState(payment?.currency ?? baseCurrency);

  // Filtrar facturas del proveedor seleccionado
  const eligibleInvoices = invoices.filter((inv) => inv.supplier.id === supplierId);

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="payment-supplier" className="text-sm font-medium">
          Proveedor
        </label>
        <select
          id="payment-supplier"
          name="supplierId"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          data-testid="payment-supplier"
          className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
          required
        >
          <option value="">Elige un proveedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="payment-date" className="text-sm font-medium">
            Fecha
          </label>
          <input
            id="payment-date"
            name="date"
            type="date"
            max={settings.today}
            defaultValue={payment?.paymentDate ?? settings.today}
            data-testid="payment-date"
            className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="payment-method" className="text-sm font-medium">
            Forma de pago
          </label>
          <select
            id="payment-method"
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            data-testid="payment-method"
            className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="payment-reference" className="text-sm font-medium">
          Referencia <span className="text-muted font-normal">(opcional)</span>
        </label>
        <input
          id="payment-reference"
          name="reference"
          defaultValue={payment?.reference ?? ''}
          autoComplete="off"
          data-testid="payment-reference"
          className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="payment-currency" className="text-sm font-medium">
            Moneda en que paga
          </label>
          <select
            id="payment-currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            data-testid="payment-currency"
            className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {currencyOptions(currencies, payment?.currency, baseCurrency).map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} — {option.name}
              </option>
            ))}
          </select>
        </div>
        {offersManualRate(currency, baseCurrency, settings.allowsRateOverride) ? (
          <div className="flex-1 space-y-1.5">
            <label htmlFor="payment-exchange-rate" className="text-sm font-medium">
              Tasa en Bs. <span className="text-muted font-normal">(vacía: la del día)</span>
            </label>
            <input
              id="payment-exchange-rate"
              name="exchangeRate"
              inputMode="decimal"
              placeholder="Automática"
              defaultValue={payment?.manualExchangeRate && payment.exchangeRate !== null ? formatRate(payment.exchangeRate) : ''}
              data-testid="payment-exchange-rate"
              className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      <TextArea label="Notas" name="notes" testId="payment-notes" defaultValue={payment?.notes ?? ''} />

      <fieldset className="space-y-2" data-testid="payment-invoices">
        <legend className="text-sm font-medium">Facturas</legend>
        <p className="text-muted text-xs">
          Escribe cuánto se paga de cada factura, en la moneda de la factura. Las que dejes vacías no son parte del pago.
        </p>

        {supplierId === '' ? <p className="text-muted text-sm">Elige primero el proveedor.</p> : null}
        {supplierId !== '' && eligibleInvoices.length === 0 ? (
          <p className="text-muted text-sm">Este proveedor no tiene facturas pendientes registradas.</p>
        ) : null}

        {eligibleInvoices.map((invoice) => {
          const allocation = payment?.allocations.find((a) => a.invoiceId === invoice.id);
          const currentAmount = allocation ? allocation.amount : null;

          return (
            <div key={invoice.id} className="border-line flex items-center gap-2 rounded-md border p-2">
              <input type="hidden" name="allocationInvoice" value={invoice.id} />
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-mono">{invoice.code}</p>
                <p className="text-muted">
                  Saldo: {invoice.currency} {formatAmount(invoice.balance)} · Vence: {invoice.dueDate}
                </p>
              </div>
              <input
                name="allocationAmount"
                defaultValue={currentAmount === null ? '' : formatAmount(currentAmount)}
                inputMode="decimal"
                aria-label={`Monto para ${invoice.code}`}
                placeholder="Monto"
                data-testid={`payment-allocation-${invoice.code}`}
                className="border-line w-28 rounded-md border bg-transparent px-2 py-2 text-sm"
              />
            </div>
          );
        })}
      </fieldset>
    </>
  );
}

function PaymentFilters({
  search,
  suppliers,
  count,
}: {
  search: PaymentSearch;
  suppliers: Supplier[];
  count: number;
}) {
  const pageHref = (page: number) =>
    `/cuentas-por-pagar/pagos?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.supplierId ? { proveedor: search.supplierId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="payment-filter">
        <Filter label="Buscar" htmlFor="payment-search">
          <input
            id="payment-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código del pago o referencia"
            data-testid="payment-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {suppliers.length > 0 ? (
          <Filter label="Proveedor" htmlFor="payment-filter-supplier">
            <select
              id="payment-filter-supplier"
              name="proveedor"
              defaultValue={search.supplierId}
              data-testid="payment-filter-supplier"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Filter>
        ) : null}

        <Filter label="Estado" htmlFor="payment-filter-status">
          <select
            id="payment-filter-status"
            name="estado"
            defaultValue={search.status}
            data-testid="payment-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Filter>

        <Filter label="Desde" htmlFor="payment-filter-from">
          <input
            id="payment-filter-from"
            type="date"
            name="desde"
            defaultValue={search.from}
            data-testid="payment-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Hasta" htmlFor="payment-filter-to">
          <input
            id="payment-filter-to"
            type="date"
            name="hasta"
            defaultValue={search.to}
            data-testid="payment-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <button
          type="submit"
          data-testid="payment-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm font-medium"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="payment"
        page={search.page}
        pageSize={search.pageSize}
        count={count}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />
    </div>
  );
}
