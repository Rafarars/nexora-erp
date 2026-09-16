const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts', 'utf8');

const curr = ", currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false";
const ves = ", subtotalVes: 0, taxVes: 0, totalVes: 0";

file = file.replace(
  "status: 'dispatched', updatedAt: date",
  `status: 'dispatched'${curr}${ves}, updatedAt: date`
);

file = file.replace(
  "total: invoice.total,",
  `total: invoice.total${curr}${ves},`
);

fs.writeFileSync('apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts', file);
