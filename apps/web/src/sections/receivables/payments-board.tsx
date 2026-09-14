'use client';

import { useActionState, useState } from 'react';
import { changePayment, savePayment } from '@/app/(app)/cuentas-por-cobrar/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, customersWithDebt, overdueLabel, payableInvoices, paymentActions } from '@/modules/receivables/domain/receivables';
import type { Payment, PaymentMethod, Receivable } from '@/modules/receivables/domain/receivables';

export function PaymentsBoard({
  payments,
  receivables,
  today,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  payments: Payment[];
  receivables: Receivable[];
  today: string;
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [editing, setEditing] = useState<Payment | null>(null);
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
          <h2 className="text-base font-semibold">Cobros</h2>
          <p className="text-muted mt-1 text-sm">
            Un borrador no toca ningún saldo. Confirmado, baja lo que deben sus facturas; anularlo se lo devuelve.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-payment"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nuevo cobro
          </button>
        ) : null}
      </div>

      <FormError message={changeState.error} testId="payment-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="payments-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Forma de pago</th>
              <th className="px-4 py-2 font-medium">Facturas</th>
              <th className="px-4 py-2 text-right font-medium">Monto</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const actions = paymentActions(payment);
              const offered = { edit: canUpdate && actions.edit, confirm: canConfirm && actions.confirm, cancel: canCancel && actions.cancel };

              return (
                <tr key={payment.id} className="border-line border-t align-top" data-testid={`payment-row-${payment.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{payment.code}</p>
                    <p className="text-muted text-xs">{payment.paymentDate}</p>
                  </td>
                  <td className="px-4 py-3">{payment.customer.name}</td>
                  <td className="px-4 py-3">
                    <p>{PAYMENT_METHOD_LABELS[payment.method]}</p>
                    {payment.reference ? <p className="text-muted text-xs">{payment.reference}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {payment.allocations.map((allocation) => (
                      <p key={allocation.invoiceId}>
                        <span className="font-mono">{allocation.invoiceCode}</span> {formatAmount(allocation.amount)}
                      </p>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right" data-testid={`payment-amount-${payment.code}`}>
                    {formatAmount(payment.amount)}
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
                  Todavía no hay cobros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar ${editing.code}` : 'Nuevo cobro'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="payment-panel"
      >
        <form action={save} className="space-y-4" key={editing?.id ?? 'new'}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <PaymentFields payment={editing} receivables={receivables} today={today} />
          <FormError message={saveState.error} testId="payment-error" />
          <SubmitButton pending={saving} testId="payment-submit">
            Guardar borrador
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

function PaymentFields({ payment, receivables, today }: { payment: Payment | null; receivables: Receivable[]; today: string }) {
  const [customerId, setCustomerId] = useState(payment?.customer.id ?? '');
  const invoices = payableInvoices(receivables, customerId, payment);

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="payment-customer" className="text-sm font-medium">
          Cliente
        </label>
        <select
          id="payment-customer"
          name="customerId"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          data-testid="payment-customer"
          className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Elige un cliente</option>
          {customersWithDebt(receivables, payment).map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
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
            max={today}
            defaultValue={payment?.paymentDate ?? today}
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
            defaultValue={payment?.method ?? 'transfer'}
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

      <TextArea label="Notas" name="notes" testId="payment-notes" defaultValue={payment?.notes ?? ''} />

      <fieldset className="space-y-2" data-testid="payment-invoices">
        <legend className="text-sm font-medium">Facturas</legend>
        <p className="text-muted text-xs">Escribe cuánto se cobra de cada factura. Las que dejes vacías no son parte del cobro.</p>

        {customerId === '' ? <p className="text-muted text-sm">Elige primero el cliente.</p> : null}
        {customerId !== '' && invoices.length === 0 ? <p className="text-muted text-sm">Este cliente no debe nada.</p> : null}

        {invoices.map(({ invoice, amount }) => (
          <div key={invoice.id} className="border-line flex items-center gap-2 rounded-md border p-2">
            <input type="hidden" name="allocationInvoice" value={invoice.id} />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-mono">{invoice.code}</p>
              <p className="text-muted">
                Debe {formatAmount(invoice.balance)} · vence {invoice.dueDate} · {overdueLabel(invoice.daysOverdue)}
              </p>
            </div>
            <input
              name="allocationAmount"
              defaultValue={amount === null ? '' : formatAmount(amount)}
              inputMode="decimal"
              aria-label={`Monto para ${invoice.code}`}
              placeholder="Monto"
              data-testid={`payment-allocation-${invoice.code}`}
              className="border-line w-28 rounded-md border bg-transparent px-2 py-2 text-sm"
            />
          </div>
        ))}
      </fieldset>
    </>
  );
}
