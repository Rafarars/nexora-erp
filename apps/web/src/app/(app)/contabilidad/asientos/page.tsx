import { JournalEntriesTable } from '@/sections/accounting/journal-entries-table';
import { accountingApi } from '@/shared/session/accounting-api';
import { requireSession } from '@/shared/session/current-session';
import type { SearchJournalEntriesResponse } from '@/modules/accounting/domain/accounting';
import { getEntryDetail } from '../actions';

export default async function JournalEntriesPage() {
  const { token } = await requireSession();

  let initialData: SearchJournalEntriesResponse = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };

  try {
    initialData = await accountingApi().searchEntries(token);
  } catch {
    initialData = { items: [], total: 0, page: 1, pageSize: 20 };
  }

  return (
    <div className="space-y-4">
      <JournalEntriesTable
        initialData={initialData}
        onFetchDetail={getEntryDetail}
      />
    </div>
  );
}
