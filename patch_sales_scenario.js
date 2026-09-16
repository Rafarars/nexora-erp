const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/sales/application/testing/sales-scenario.ts', 'utf8');

file = file.replace(
  "const store = new InMemorySalesStore();",
  "const store = new InMemorySalesStore();\n  const rates = { ratesFor: async () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false }) } as any;"
);

fs.writeFileSync('apps/api/src/contexts/sales/application/testing/sales-scenario.ts', file);
