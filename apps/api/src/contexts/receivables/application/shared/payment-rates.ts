import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { PaymentRates } from '../../domain/payment/customer-payment.entity.js';

export interface PaymentRatesRequest {
  // Sin moneda, la de la empresa.
  currency?: string | null;
  date: string;
  // La tasa de la moneda del cobro escrita a mano.
  manualRate?: number | null;
  keepsCurrency: boolean;
}

// Las tasas del dia del cobro: la de su moneda y la de cada moneda de las facturas que aplica.
export async function paymentRates(rates: DocumentRates, tenantId: string, request: PaymentRatesRequest, invoices: ReceivableInvoice[]): Promise<PaymentRates> {
  const own = await rates.forDocument(tenantId, request);
  const invoiceRates: Record<string, number> = { [own.currency]: own.exchangeRate };

  for (const code of new Set(invoices.map((invoice) => invoice.currency().currency))) {
    if (!(code in invoiceRates)) invoiceRates[code] = (await rates.forDocument(tenantId, { currency: code, date: request.date, keepsCurrency: true })).exchangeRate;
  }

  return { currency: DocumentCurrency.of(own), invoiceRates, decimals: await rates.amountDecimals(tenantId) };
}
