import { FormError } from '@/sections/shared/field';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { creditLabel } from '@/modules/receivables/domain/receivables';
import type { Statement } from '@/modules/receivables/domain/receivables';

// Un formulario GET: el cliente elegido queda en la direccion y la pagina se puede compartir.
export function StatementView({
  customers,
  selected,
  statement,
  error,
}: {
  customers: { id: string; name: string }[];
  selected: string;
  statement: Statement | null;
  error: string | null;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Estado de cuenta</h2>
        <p className="text-muted mt-1 text-sm">Las facturas emitidas y los cobros confirmados de un cliente, por fecha, con lo que debe después de cada uno.</p>
      </div>

      <form method="get" className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="statement-customer" className="text-sm font-medium">
            Cliente
          </label>
          <select
            id="statement-customer"
            name="cliente"
            defaultValue={selected}
            data-testid="statement-customer"
            className="border-line bg-background w-64 rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Elige un cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" data-testid="statement-submit" className="border-line rounded-md border px-3 py-2 text-sm">
          Ver
        </button>
      </form>

      <FormError message={error} testId="statement-error" />

      {statement ? (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="statement-summary">
            <Summary label="Saldo" value={formatAmount(statement.summary.balance)} testId="statement-balance" />
            <Summary label="Vencido" value={formatAmount(statement.summary.overdue)} testId="statement-overdue" />
            <Summary label="Límite de crédito" value={statement.summary.paymentTermDays === 0 ? 'Contado' : creditLabel(statement.summary.creditLimit, formatAmount)} testId="statement-limit" />
            <Summary
              label="Crédito disponible"
              value={statement.summary.creditBlocked ? 'Bloqueado por vencidas' : statement.summary.availableCredit === null ? '—' : formatAmount(statement.summary.availableCredit)}
              testId="statement-available"
            />
          </dl>

          <div className="border-line overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="statement-table">
              <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Documento</th>
                  <th className="px-4 py-2 text-right font-medium">Cargo</th>
                  <th className="px-4 py-2 text-right font-medium">Abono</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2 text-right font-medium">Dif. cambiaria (Bs.)</th>
                </tr>
              </thead>
              <tbody>
                {statement.movements.map((movement, index) => (
                  <tr key={`${movement.type}-${movement.code}`} className="border-line border-t" data-testid={`statement-row-${index + 1}`}>
                    <td className="px-4 py-3">{movement.date}</td>
                    <td className="px-4 py-3">
                      {movement.type === 'invoice' ? 'Factura' : 'Cobro'} <span className="font-mono text-xs">{movement.code}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{movement.debit > 0 ? formatAmount(movement.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right">{movement.credit > 0 ? formatAmount(movement.credit) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium" data-testid={`statement-balance-${index + 1}`}>
                      {formatAmount(movement.balance)}
                    </td>
                    <td className="text-muted px-4 py-3 text-right" data-testid={`statement-difference-${index + 1}`}>
                      {movement.exchangeDifference === null ? '—' : formatAmount(movement.exchangeDifference)}
                    </td>
                  </tr>
                ))}

                {statement.movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted px-4 py-6 text-center" data-testid="statement-empty">
                      Este cliente no tiene facturas ni cobros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Summary({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="border-line rounded-lg border p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-1 font-medium" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
