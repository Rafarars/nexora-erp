import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReportPage, pageOf } from '../../domain/page/report-page.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface TrialBalanceRequest {
  tenantId: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface TrialBalanceAccountRef {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface TrialBalanceRow {
  account: TrialBalanceAccountRef;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceTotals {
  debit: number;
  credit: number;
  difference: number;
  isBalanced: boolean;
}

export interface TrialBalanceResponse {
  from: string | null;
  to: string | null;
  currency: string;
  decimals: number;
  page: ReportPage;
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotals;
}

// Balanza de comprobacion: todas las cuentas que reciben asientos con debe, haber y saldo.
// La suma total de debe y haber tiene que ser identica (partida doble).
export class TrialBalanceReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: TrialBalanceRequest): Promise<TrialBalanceResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const [decimals, currency] = await Promise.all([
      this.rates.amountDecimals(request.tenantId),
      this.rates.companyCurrency(request.tenantId),
    ]);

    const accounts = await this.readModel.trialBalance(tenantId, request.from, request.to);

    const rows: TrialBalanceRow[] = accounts.map((acc) => {
      const debit = Number(acc.debit.toFixed(decimals));
      const credit = Number(acc.credit.toFixed(decimals));
      const isDebitNature = acc.type === 'asset' || acc.type === 'expense';
      const balance = Number((isDebitNature ? debit - credit : credit - debit).toFixed(decimals));

      return {
        account: {
          id: acc.accountId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
        },
        debit,
        credit,
        balance,
      };
    });

    const totalDebit = Number(rows.reduce((sum, r) => sum + r.debit, 0).toFixed(decimals));
    const totalCredit = Number(rows.reduce((sum, r) => sum + r.credit, 0).toFixed(decimals));
    const difference = Number(Math.abs(totalDebit - totalCredit).toFixed(decimals));
    const isBalanced = difference === 0;

    const shown = pageOf(rows, request.limit, request.offset);

    return {
      from: request.from ?? null,
      to: request.to ?? null,
      currency,
      decimals,
      page: shown.page,
      rows: shown.rows,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        difference,
        isBalanced,
      },
    };
  }
}
