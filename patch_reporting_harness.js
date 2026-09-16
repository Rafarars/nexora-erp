const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts', 'utf8');

const curr = ", currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false";
const ves = ", subtotalVes: 0, taxVes: 0, totalVes: 0";
const currPayment = ", currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, amountVes: 0";

file = file.replace(
  "status: 'dispatched', updatedAt: asDate(month) } });",
  `status: 'dispatched'${curr}${ves}, updatedAt: asDate(month) } });`
);

file = file.replace(
  "total: amount, updatedAt: asDate(month) } });",
  `total: amount${curr}${ves}, updatedAt: asDate(month) } });`
);

file = file.replace(
  "status: 'confirmed', updatedAt: asDate(month) } });",
  `status: 'confirmed'${currPayment}, updatedAt: asDate(month) } });`
);

file = file.replace(
  "status: 'confirmed' as const, updatedAt: asDate(month) } });",
  `status: 'confirmed' as const${currPayment}, updatedAt: asDate(month) } });`
);

fs.writeFileSync('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts', file);
