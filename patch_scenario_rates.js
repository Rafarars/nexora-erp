const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts', 'utf8');

file = file.replace(
  "const clock = new StubClock();",
  "const clock = new StubClock();\n  const rates = { ratesFor: async () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false }) } as any;"
);

fs.writeFileSync('apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts', file);
