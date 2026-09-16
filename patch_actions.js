const fs = require('fs');

let file = fs.readFileSync('apps/web/src/app/(app)/cuentas-por-cobrar/actions.ts', 'utf8');

file = file.replace(
  "allocations: invoices",
  "currency: 'USD',\n      manualExchangeRate: parseDecimal(optional(form, 'manualExchangeRate') || ''),\n      allocations: invoices"
);

fs.writeFileSync('apps/web/src/app/(app)/cuentas-por-cobrar/actions.ts', file);
