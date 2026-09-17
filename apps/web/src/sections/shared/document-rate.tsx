import { formatRate, inBolivars } from '@/modules/company/domain/company';
import type { DocumentCurrency } from '@/modules/company/domain/company';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';

// La tasa que congelo un documento y, si se da un importe, lo que vale en bolivares. Una factura o un
// cobro traen sus bolivares ya escritos (`bolivars`). Un documento en bolivares o anterior a las
// tasas no muestra nada.
export function DocumentRate({
  document,
  amount,
  bolivars,
  testId,
}: {
  document: DocumentCurrency;
  amount?: number;
  bolivars?: number | null;
  testId: string;
}) {
  if (document.exchangeRate === null || document.currency === 'VES') return null;

  const inVes = bolivars !== undefined ? bolivars : amount === undefined ? null : inBolivars(amount, document);

  return (
    <p className="text-muted text-xs" data-testid={testId}>
      {document.currency} a {formatRate(document.exchangeRate)} Bs.{document.manualExchangeRate ? ' (a mano)' : ''}
      {inVes === null ? '' : ` · Bs. ${formatAmount(inVes)}`}
    </p>
  );
}
