import Link from 'next/link';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { AGING_COLUMNS, creditLabel } from '@/modules/receivables/domain/receivables';
import type { AgingTotals, CustomerBalance } from '@/modules/receivables/domain/receivables';

// La antiguedad de saldos: lo que debe cada cliente repartido por cuanto lleva vencido.
export function AgingTable({ customers, totals, canReadStatement }: { customers: CustomerBalance[]; totals: AgingTotals; canReadStatement: boolean }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Antigüedad de saldos</h2>
        <p className="text-muted mt-1 text-sm">
          Solo aparecen los clientes que deben algo. El crédito disponible es el límite menos lo que debe; con vencidas, el cliente queda bloqueado para facturar a crédito.
        </p>
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="aging-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Cliente</th>
              {AGING_COLUMNS.map((column) => (
                <th key={column.bucket} className="px-4 py-2 text-right font-medium">
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((row) => (
              <tr key={row.customer.id} className="border-line border-t align-top" data-testid={`aging-row-${row.customer.code}`}>
                <td className="px-4 py-3">
                  {canReadStatement ? (
                    <Link href={`/cuentas-por-cobrar/estado-de-cuenta?cliente=${row.customer.id}`} className="font-medium underline-offset-2 hover:underline">
                      {row.customer.name}
                    </Link>
                  ) : (
                    <p className="font-medium">{row.customer.name}</p>
                  )}
                  <p className="text-muted font-mono text-xs">{row.customer.code}</p>
                </td>
                {AGING_COLUMNS.map((column) => (
                  <td key={column.bucket} className="px-4 py-3 text-right" data-testid={`aging-${column.bucket}-${row.customer.code}`}>
                    {row.aging[column.bucket] > 0 ? formatAmount(row.aging[column.bucket]) : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-medium" data-testid={`aging-balance-${row.customer.code}`}>
                  {formatAmount(row.balance)}
                </td>
                <td className="px-4 py-3 text-xs" data-testid={`aging-credit-${row.customer.code}`}>
                  <CreditCell row={row} />
                </td>
              </tr>
            ))}

            {customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-muted px-4 py-6 text-center" data-testid="aging-empty">
                  Ningún cliente debe nada.
                </td>
              </tr>
            ) : (
              <tr className="border-line bg-surface border-t font-medium" data-testid="aging-totals">
                <td className="px-4 py-3">Total</td>
                {AGING_COLUMNS.map((column) => (
                  <td key={column.bucket} className="px-4 py-3 text-right">
                    {formatAmount(totals[column.bucket])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">{formatAmount(totals.total)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreditCell({ row }: { row: CustomerBalance }) {
  if (row.paymentTermDays === 0) return <p className="text-muted">Contado</p>;

  return (
    <>
      <p>Límite {creditLabel(row.creditLimit, formatAmount)}</p>
      {row.availableCredit !== null ? <p className="text-muted">Disponible {formatAmount(row.availableCredit)}</p> : null}
      {row.creditBlocked ? <p className="text-red-600">Bloqueado por vencidas</p> : null}
    </>
  );
}
