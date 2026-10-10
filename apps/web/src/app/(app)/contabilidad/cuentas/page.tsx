import { can } from '@/modules/access/domain/session';
import { AccountsTreeTable } from '@/sections/accounting/accounts-tree-table';
import { accountingApi } from '@/shared/session/accounting-api';
import { requireSession } from '@/shared/session/current-session';
import type { AccountRow } from '@/modules/accounting/domain/accounting';

export default async function AccountsPage() {
  const { token, session } = await requireSession();

  let accounts: AccountRow[] = [];
  try {
    accounts = (await accountingApi().searchAccounts(token)) as AccountRow[];
  } catch {
    accounts = [];
  }

  return (
    <div className="space-y-4">
      <AccountsTreeTable
        accounts={accounts}
        canCreate={can(session, 'accounting.accounts.create')}
        canUpdate={can(session, 'accounting.accounts.update')}
        canDeactivate={can(session, 'accounting.accounts.deactivate')}
      />
    </div>
  );
}
