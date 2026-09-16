const fs = require('fs');

let file = fs.readFileSync('apps/web/src/modules/receivables/domain/receivables.ts', 'utf8');

file = file.replace(
  '  amount: number;\n  status: PaymentStatus;',
  '  amount: number;\n  amountVes: number | null;\n  currency: string;\n  exchangeRate: number | null;\n  baseCurrency: string;\n  baseExchangeRate: number | null;\n  manualExchangeRate: boolean;\n  status: PaymentStatus;'
);

fs.writeFileSync('apps/web/src/modules/receivables/domain/receivables.ts', file);
