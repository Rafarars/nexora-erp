const fs = require('fs');

function addVes(file) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/manualExchangeRate: false/g, "manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0, amountVes: 0");
  fs.writeFileSync(file, text);
}

addVes('apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts');
addVes('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts');
