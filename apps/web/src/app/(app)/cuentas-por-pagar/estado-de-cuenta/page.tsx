import { StatementView } from '@/sections/payables/statement-view';
import { can } from '@/modules/access/domain/session';
import { AccessError } from '@/modules/access/domain/access-error';
import { readablePayablesError } from '@/modules/payables/domain/payables-error';
import { payablesApi } from '@/shared/session/payables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'payables.statements.search')) {
    return (
      <p className="text-muted text-sm" data-testid="statement-forbidden">
        Tu rol no tiene permiso para ver estados de cuenta de esta empresa.
      </p>
    );
  }

  const { proveedor } = await searchParams;
  const suppliers = can(session, 'payables.balances.search') ? await payablesApi().allSuppliers(token) : [];

  let statement = null;
  let error = null;

  if (proveedor) {
    try {
      statement = await payablesApi().searchStatement(token, proveedor);
    } catch (caught) {
      if (!(caught instanceof AccessError)) throw caught;

      error = readablePayablesError(caught, 'No se pudo leer el estado de cuenta.');
    }
  }

  return <StatementView suppliers={suppliers} selected={proveedor ?? ''} statement={statement} error={error} />;
}
