import { StatementView } from '@/sections/receivables/statement-view';
import { can } from '@/modules/access/domain/session';
import { AccessError } from '@/modules/access/domain/access-error';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import { receivablesApi } from '@/shared/session/receivables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.statements.search')) {
    return (
      <p className="text-muted text-sm" data-testid="statement-forbidden">
        Tu rol no tiene permiso para ver estados de cuenta de esta empresa.
      </p>
    );
  }

  const { cliente } = await searchParams;
  // Los clientes a elegir son los que alguna vez se facturaron, no solo los de una pagina.
  const receivables = can(session, 'receivables.balances.search') ? await receivablesApi().allReceivables(token) : [];
  const customers = [...new Map(receivables.map((row) => [row.customer.id, row.customer.name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let statement = null;
  let error = null;

  if (cliente) {
    try {
      statement = await receivablesApi().searchStatement(token, cliente);
    } catch (caught) {
      if (!(caught instanceof AccessError)) throw caught;

      error = readableReceivablesError(caught, 'No se pudo leer el estado de cuenta.');
    }
  }

  return <StatementView customers={customers} selected={cliente ?? ''} statement={statement} error={error} />;
}
