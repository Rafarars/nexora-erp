const fs = require('fs');
let f2 = 'apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts';
let t2 = fs.readFileSync(f2, 'utf8');
t2 = t2.replace(/id: previous.find\(\(kept\) => kept.invoiceId === allocation.invoiceId\)\?.id \?\? this.ids.next\(\),\n\s*\.\.\.allocation,\n\s*\}\)\),/g, 'id: previous.find((kept) => kept.invoiceId === allocation.invoiceId)?.id ?? this.ids.next(),\n          ...allocation,\n          exchangeDifference: 0\n        })),');
fs.writeFileSync(f2, t2);
