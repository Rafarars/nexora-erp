const fs = require('fs');

let file = 'apps/api/src/contexts/inventory/infrastructure/testing/prisma-item-ports.harness.ts';
let text = fs.readFileSync(file, 'utf8');

if (!text.includes("currency: 'USD'")) {
  text = text.replace(/status: order.status/g, "status: order.status, currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0");
}
fs.writeFileSync(file, text);
