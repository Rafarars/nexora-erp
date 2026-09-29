import { FormError } from '@/sections/shared/field';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import type { Statement } from '@/modules/payables/domain/payables';

export function StatementView({
  suppliers,
  selected,
  statement,
  error,
}: {
  suppliers: { id: string; name: string }[];
  selected: string;
  statement: Statement | null;
  error: string | null;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Estado de cuenta</h2>
        <p className="text-muted mt-1 text-sm">
          Las facturas emitidas y los pagos confirmados de un proveedor, ordenados cronológicamente con el saldo acumulado tras cada uno.
        </p>
      </div>

      <form method="get" className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="statement-supplier" className="text-sm font-medium">
            Proveedor
          </label>
          <select
            id="statement-supplier"
            name="proveedor"
            defaultValue={selected}
            data-testid="statement-supplier"
            className="border-line bg-background w-64 rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Elige un proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" data-testid="statement-submit" className="border-line rounded-md border px-3 py-2 text-sm font-medium">
          Ver
        </button>
      </form>

      <FormError message={error} testId="statement-error" />

      {statement ? (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-2" data-testid="statement-summary">
            <Summary label="Saldo total" value={formatAmount(statement.summary.balance)} testId="statement-balance" />
            <Summary label="Vencido" value={formatAmount(statement.summary.overdue)} testId="statement-overdue" />
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
                  <tr key={`${movement.type}-${movement.code}-${index}`} className="border-line border-t" data-testid={`statement-row-${index + 1}`}>
                    <td className="px-4 py-3">{movement.date}</td>
                    <td className="px-4 py-3">
                      {movement.type === 'invoice' ? 'Factura' : 'Pago'} <span className="font-mono text-xs">{movement.code}</span>
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
                      Este proveedor no tiene facturas ni pagos registrados.
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
    <div className="border-line rounded-lg border p-4">
      <dt className="text-muted text-xs uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-xl font-semibold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
