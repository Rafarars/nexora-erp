import { InvoicesBoard } from '@/sections/sales/invoices-board';
import { can } from '@/modules/access/domain/session';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.invoices.search')) {
    return (
      <p className="text-muted text-sm" data-testid="invoices-forbidden">
        Tu rol no tiene permiso para ver las facturas de esta empresa.
      </p>
    );
  }

  return <InvoicesBoard invoices={await salesApi().searchInvoices(token)} canCancel={can(session, 'sales.invoices.cancel')} />;
}
