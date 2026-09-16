const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts', 'utf8');

file = file.replace(
  "  allocations: { invoiceId: string; amount: number }[];\n}",
  "  allocations: { invoiceId: string; amount: number }[];\n  currency?: string | null;\n  manualExchangeRate?: number | null;\n}"
);

file = file.replace(
  "    private readonly ids: IdGenerator,\n    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n  ) {}",
  "    private readonly ids: IdGenerator,\n    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n    private readonly rates: DocumentRates,\n  ) {}"
);

file = file.replace(
  "    const details = {\n      customerId: request.customerId,",
  "    const rates = await this.rates.ratesFor(tenantId, request.currency, request.manualExchangeRate, today);\n\n    const details = {\n      customerId: request.customerId,\n      currency: rates,"
);

file = file.replace(
  "allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation })),",
  "allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation, exchangeDifference: 0 })),"
);

fs.writeFileSync('apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts', file);
