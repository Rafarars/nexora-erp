const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/application/create-payment/payment-creator.ts', 'utf8');

file = file.replace(
  "    private readonly calendar: BusinessCalendar,\n  ) {}",
  "    private readonly calendar: BusinessCalendar,\n    private readonly rates: DocumentRates,\n  ) {}"
);

file = file.replace(
  "  allocations: { invoiceId: string; amount: number }[];\n}",
  "  allocations: { invoiceId: string; amount: number }[];\n  currency?: string | null;\n  manualExchangeRate?: number | null;\n}"
);

file = file.replace(
  "    const details = {\n      customerId: request.customerId,",
  "    const rates = await this.rates.ratesFor(tenantId, request.currency, request.manualExchangeRate, today);\n\n    const details = {\n      customerId: request.customerId,\n      currency: rates,"
);

fs.writeFileSync('apps/api/src/contexts/receivables/application/create-payment/payment-creator.ts', file);
