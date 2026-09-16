import { ReactNode } from 'react';
import { FormError } from '@/sections/shared/field';
import { offersManualRate } from '@/modules/sales/domain/sales';

interface ExchangeRateFieldProps {
  currency: string;
  baseCurrency: string;
  allowsRateOverride: boolean;
  defaultValue?: number | null;
  error?: string[];
}

export function ExchangeRateField({ currency, baseCurrency, allowsRateOverride, defaultValue, error }: ExchangeRateFieldProps) {
  const showManualRate = offersManualRate(currency, baseCurrency, allowsRateOverride);

  if (!showManualRate) return null;

  return (
    <div className="space-y-1.5">
      <label htmlFor="manualExchangeRate" className="text-sm font-medium">
        Tasa de cambio (opcional)
      </label>
      <input
        id="manualExchangeRate"
        name="manualExchangeRate"
        type="number"
        step="0.0001"
        defaultValue={defaultValue === null || defaultValue === undefined ? '' : String(defaultValue)}
        placeholder="Automática"
        data-testid="manual-exchange-rate"
        className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
      />
      <FormError message={error?.[0] ?? null} testId="manual-exchange-rate-error" />
    </div>
  );
}
