import { AccessError } from '@/modules/access/domain/access-error';
import { can } from '@/modules/access/domain/session';
import { rateCurrencies } from '@/modules/company/domain/company';
import type { ExchangeRateBoard } from '@/modules/company/domain/company';
import { readableCompanyError } from '@/modules/company/domain/company-error';
import { ExchangeRatesBoard } from '@/sections/company/exchange-rates-board';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ExchangeRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ moneda?: string; tipo?: string; desde?: string; hasta?: string }>;
}) {
  const { session, token } = await requireSession();

  if (!can(session, 'company.rates.search')) {
    return (
      <p className="text-muted text-sm" data-testid="rates-forbidden">
        Tu rol no tiene permiso para ver las tasas de cambio de esta empresa.
      </p>
    );
  }

  const { moneda = '', tipo = '', desde = '', hasta = '' } = await searchParams;
  const filter = { currency: moneda, type: tipo, from: desde, to: hasta };
  const api = companyApi();
  let board: ExchangeRateBoard | null = null;
  let error: string | null = null;

  try {
    board = await api.exchangeRates(token, filter);
  } catch (caught) {
    if (!(caught instanceof AccessError)) throw caught;

    error = readableCompanyError(caught, 'No se pudieron leer las tasas con esos filtros.');
  }

  return (
    <ExchangeRatesBoard
      board={board}
      error={error}
      filter={filter}
      currencies={rateCurrencies(await api.currencies(token))}
      today={(await api.settings(token)).today}
      canRecord={can(session, 'company.rates.record')}
      canDeactivate={can(session, 'company.rates.deactivate')}
    />
  );
}
