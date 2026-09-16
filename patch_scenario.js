const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts', 'utf8');

file = file.replace(
  "createPayment: new PaymentCreator(store.ledger, store.payments, codes, ids, clock, calendar),",
  "createPayment: new PaymentCreator(store.ledger, store.payments, codes, ids, clock, calendar, rates),"
);
file = file.replace(
  "updatePayment: new PaymentUpdater(store.payments, ids, clock, calendar),",
  "updatePayment: new PaymentUpdater(store.payments, ids, clock, calendar, rates),"
);

fs.writeFileSync('apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts', file);
