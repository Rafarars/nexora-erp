import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { AccountRow, AccountTreeNode, AccountType, JournalEntryDetail, SearchJournalEntriesResponse } from '../domain/accounting';

const BASE = '/api/v1/accounting';

function queryOf(filters: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }

  return query.size > 0 ? `?${query.toString()}` : '';
}

export class HttpAccountingApi {
  constructor(private readonly baseUrl: string) {}

  async searchAccounts(
    token: string,
    filters: { isActive?: boolean; type?: AccountType; tree?: boolean } = {},
  ): Promise<AccountRow[] | AccountTreeNode[]> {
    return this.request('GET', `${BASE}/accounts${queryOf(filters)}`, token);
  }

  async getAccountTree(token: string): Promise<AccountTreeNode[]> {
    return this.request('GET', `${BASE}/accounts?tree=true`, token);
  }

  async createAccount(
    token: string,
    input: {
      code: string;
      name: string;
      type: AccountType;
      acceptsEntries: boolean;
      parentId?: string | null;
    },
  ): Promise<{ id: string }> {
    return this.request('POST', `${BASE}/accounts`, token, input);
  }

  async updateAccount(
    token: string,
    id: string,
    input: {
      name?: string;
      isActive?: boolean;
      acceptsEntries?: boolean;
    },
  ): Promise<void> {
    await this.request('PUT', `${BASE}/accounts/${id}`, token, input);
  }

  async changeAccountStatus(token: string, id: string, isActive: boolean): Promise<void> {
    await this.request('PUT', `${BASE}/accounts/${id}/status`, token, { isActive });
  }

  async searchEntries(
    token: string,
    filters: {
      originType?: string;
      originId?: string;
      from?: string;
      to?: string;
      accountId?: string;
      query?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<SearchJournalEntriesResponse> {
    return this.request('GET', `${BASE}/entries${queryOf(filters)}`, token);
  }

  async getEntry(token: string, id: string): Promise<JournalEntryDetail> {
    return this.request('GET', `${BASE}/entries/${id}`, token);
  }

  private async request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw AccessError.fromStatus(response.status, await errorBodyOf(response));
    }

    const text = await response.text();

    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
  }
}

async function errorBodyOf(response: Response): Promise<AccessErrorBody> {
  try {
    return (await response.json()) as AccessErrorBody;
  } catch {
    return {};
  }
}
