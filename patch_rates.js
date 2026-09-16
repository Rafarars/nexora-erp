const fs = require('fs');
let file = 'apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts';
let text = fs.readFileSync(file, 'utf8');

if (!text.includes("ratesFor")) {
  text = text.replace("const clock = new StubClock();", "const clock = new StubClock();\n  const rates = { forDocument: async () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false }) } as any;");
  text = text.replace("createPayment: new PaymentCreator(store.ledger, store.payments, codes, ids, clock, calendar),", "createPayment: new PaymentCreator(store.ledger, store.payments, codes, ids, clock, calendar, rates),");
  text = text.replace("updatePayment: new PaymentUpdater(store.payments, ids, clock, calendar),", "updatePayment: new PaymentUpdater(store.payments, ids, clock, calendar, rates),");
}
fs.writeFileSync(file, text);

let file2 = 'apps/api/src/contexts/sales/application/testing/sales-scenario.ts';
let text2 = fs.readFileSync(file2, 'utf8');
if (!text2.includes("ratesFor") && !text2.includes("forDocument")) {
  text2 = text2.replace("const store = new InMemorySalesStore();", "const store = new InMemorySalesStore();\n  const rates = { forDocument: async () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false }) } as any;");
}
fs.writeFileSync(file2, text2);
