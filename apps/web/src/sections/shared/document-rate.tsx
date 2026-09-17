import { formatRate } from '@/modules/company/domain/company';
import { formatAmount, inBolivars } from '@/modules/purchasing/domain/purchasing';
import type { DocumentCurrency } from '@/modules/purchasing/domain/purchasing';

// La tasa que congelo un documento y, si se da un importe, lo que vale en bolivares. Un documento en
// bolivares o anterior a las tasas no muestra nada.
export function DocumentRate({ document, amount, testId }: { document: DocumentCurrency; amount?: number; testId: string }) {
  if (document.exchangeRate === null || document.currency === 'VES') return null;

  const bolivars = amount === undefined ? null : inBolivars(amount, document);

  return (
    <p className="text-muted text-xs" data-testid={testId}>
      {document.currency} a {formatRate(document.exchangeRate)} Bs.{document.manualExchangeRate ? ' (a mano)' : ''}
      {bolivars === null ? '' : ` · Bs. ${formatAmount(bolivars)}`}
    </p>
  );
}
