import { CustomersTable } from '@/sections/sales/customers-table';
import { can } from '@/modules/access/domain/session';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.customers.search')) {
    return (
      <p className="text-muted text-sm" data-testid="customers-forbidden">
        Tu rol no tiene permiso para ver los clientes de esta empresa.
      </p>
    );
  }

  return (
    <CustomersTable
      customers={await salesApi().searchCustomers(token)}
      canCreate={can(session, 'sales.customers.create')}
      canUpdate={can(session, 'sales.customers.update')}
      canDeactivate={can(session, 'sales.customers.deactivate')}
    />
  );
}
