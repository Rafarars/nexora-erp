const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/testing/receivables-ports.contract.ts', 'utf8');

file = file.replace(
  "invoiceId, amount });",
  "invoiceId, amount, exchangeDifference: 0 });"
);

file = file.replace(
  "notes: 'contrato', allocations },",
  "notes: 'contrato', allocations, currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false } as any },"
);

file = file.replace(
  "method: 'transfer', allocations: [{ id:",
  "method: 'transfer', currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false } as any, allocations: [{ id:"
);

fs.writeFileSync('apps/api/src/contexts/receivables/testing/receivables-ports.contract.ts', file);
