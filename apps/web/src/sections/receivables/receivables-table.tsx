import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { COLLECTION_STATUS_LABELS, overdueLabel } from '@/modules/receivables/domain/receivables';
import type { Receivable } from '@/modules/receivables/domain/receivables';

// Las facturas vistas desde la cobranza, las que vencen antes primero.
export function ReceivablesTable({ receivables }: { receivables: Receivable[] }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Facturas por cobrar</h2>
        <p className="text-muted mt-1 text-sm">
          Lo que debe cada factura emitida. Vencida es la que pasó su fecha y todavía debe algo; mientras un cliente tenga una, no se le factura a crédito.
        </p>
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="receivables-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Factura</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Vence</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Cobrado</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((row) => (
              <tr key={row.id} className="border-line border-t align-top" data-testid={`receivable-row-${row.code}`}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{row.code}</p>
                  <p className="text-muted text-xs">{row.issueDate}</p>
                </td>
                <td className="px-4 py-3">{row.customer.name}</td>
                <td className="px-4 py-3">
                  <p>{row.dueDate}</p>
                  <p className={`text-xs ${row.daysOverdue > 0 ? 'text-red-600' : 'text-muted'}`} data-testid={`receivable-overdue-${row.code}`}>
                    {row.balance > 0 ? overdueLabel(row.daysOverdue) : '—'}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.currency} {formatAmount(row.total)}
                </td>
                <td className="px-4 py-3 text-right" data-testid={`receivable-paid-${row.code}`}>
                  {formatAmount(row.paid)}
                </td>
                <td className="px-4 py-3 text-right font-medium" data-testid={`receivable-balance-${row.code}`}>
                  {formatAmount(row.balance)}
                </td>
                <td className="px-4 py-3" data-testid={`receivable-status-${row.code}`}>
                  {COLLECTION_STATUS_LABELS[row.status]}
                </td>
              </tr>
            ))}

            {receivables.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="receivables-empty">
                  Todavía no hay facturas emitidas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
