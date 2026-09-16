const fs = require('fs');

// 1 & 2: payment-creator.ts
let f1 = 'apps/api/src/contexts/receivables/application/create-payment/payment-creator.ts';
let t1 = fs.readFileSync(f1, 'utf8');
t1 = t1.replace(/this\.rates\.forDocument\(tenantId,/g, 'this.rates.forDocument(tenantId.value,');
t1 = t1.replace(/currency: rates,/g, 'currency: DocumentCurrency.of(rates),');
fs.writeFileSync(f1, t1);

// payment-updater.ts
let f2 = 'apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts';
let t2 = fs.readFileSync(f2, 'utf8');
if (!t2.includes("DocumentCurrency.of(")) {
    t2 = t2.replace(/this\.rates\.forDocument\(tenantId,/g, 'this.rates.forDocument(tenantId.value,');
    t2 = t2.replace(/currency: rates,/g, 'currency: DocumentCurrency.of(rates),');
}
if (!t2.includes("exchangeDifference: 0")) {
    t2 = t2.replace(/allocations: request\.allocations\.map\(\(allocation\) => \(\{\n\s*id: this\.ids\.next\(\),\n\s*\.\.\.allocation,\n\s*\}\)\),/g, 'allocations: request.allocations.map((allocation) => ({\n        id: this.ids.next(),\n        ...allocation,\n        exchangeDifference: 0\n      })),');
}
fs.writeFileSync(f2, t2);

// receivables.module.ts
let f3 = 'apps/api/src/contexts/receivables/infrastructure/receivables.module.ts';
let t3 = fs.readFileSync(f3, 'utf8');
// Fix DocumentRates import
if (!t3.includes("import { DocumentRates }")) {
    t3 = `import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';\n` + t3;
}
// Fix PaymentUpdater useFactory
t3 = t3.replace(/useFactory: \(f: PaymentFinder, l: ReceivablesLedger, r: PaymentRepository, i: IdGenerator, k: Clock, cal: BusinessCalendar\) => new PaymentUpdater\(f, l, r, i, k, cal\),/g, 
                'useFactory: (f: PaymentFinder, l: ReceivablesLedger, r: PaymentRepository, i: IdGenerator, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new PaymentUpdater(f, l, r, i, k, cal, dr),');
t3 = t3.replace(/inject: \[PaymentFinder, ReceivablesLedger, PaymentRepository, IdGenerator, Clock, BusinessCalendar\],/g, 
                'inject: [PaymentFinder, ReceivablesLedger, PaymentRepository, IdGenerator, Clock, BusinessCalendar, DocumentRateResolver],');
fs.writeFileSync(f3, t3);
