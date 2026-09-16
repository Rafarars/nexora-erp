const fs = require('fs');
let content = fs.readFileSync('apps/api/src/contexts/sales/application/confirm-order/sales-order-confirmer.ts', 'utf8');
content = content.replace(/this\.references,\n\s*this\.rates,\n\s*this\.references,/g, 'this.references,\n        this.rates,');
fs.writeFileSync('apps/api/src/contexts/sales/application/confirm-order/sales-order-confirmer.ts', content);
