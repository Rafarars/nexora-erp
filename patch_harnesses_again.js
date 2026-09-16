const fs = require('fs');

function patchFile(file) {
  let text = fs.readFileSync(file, 'utf8');
  
  // Use a regex to safely inject properties without duplicating
  // Ensure we don't already have currency: 'USD'
  if (!text.includes("currency: 'USD'")) {
    text = text.replace(/status: 'dispatched'/g, "status: 'dispatched', currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false");
    text = text.replace(/total: invoice.total,/g, "total: invoice.total, currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false,");
  }
  
  fs.writeFileSync(file, text);
}

patchFile('apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts');

let repText = fs.readFileSync('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts', 'utf8');
if (!repText.includes("currency: 'USD'")) {
  repText = repText.replace(/status: 'dispatched'/g, "status: 'dispatched', currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false");
  repText = repText.replace(/total: amount,/g, "total: amount, currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false,");
  repText = repText.replace(/status: 'confirmed'/g, "status: 'confirmed', currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false");
  repText = repText.replace(/status: 'draft'/g, "status: 'draft', currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false");
}
fs.writeFileSync('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts', repText);

