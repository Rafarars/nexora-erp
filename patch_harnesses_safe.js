const fs = require('fs');

const vesFields = ", subtotalVes: 0, taxVes: 0, totalVes: 0";
const currFields = ", currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false";
const fullInvoice = currFields + vesFields;
const fullPayment = currFields + ", amountVes: 0";

let f1 = 'apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts';
let t1 = fs.readFileSync(f1, 'utf8');
t1 = t1.replace(/status: 'dispatched', updatedAt: date/g, `status: 'dispatched', updatedAt: date${fullInvoice}`);
t1 = t1.replace(/total: invoice.total,/g, `total: invoice.total${fullInvoice},`);
fs.writeFileSync(f1, t1);

let f2 = 'apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts';
let t2 = fs.readFileSync(f2, 'utf8');
t2 = t2.replace(/status: 'dispatched', updatedAt: asDate\(month\)/g, `status: 'dispatched', updatedAt: asDate(month)${fullInvoice}`);
t2 = t2.replace(/total: amount, updatedAt: asDate\(month\)/g, `total: amount, updatedAt: asDate(month)${fullInvoice}`);
t2 = t2.replace(/status: 'confirmed', updatedAt: asDate\(month\)/g, `status: 'confirmed', updatedAt: asDate(month)${fullPayment}`);
t2 = t2.replace(/status: 'draft', updatedAt: asDate\(month\)/g, `status: 'draft', updatedAt: asDate(month)${fullPayment}`);
fs.writeFileSync(f2, t2);
