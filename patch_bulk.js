const fs = require('fs');

const harnessFiles = [
  'apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts',
  'apps/api/src/contexts/inventory/infrastructure/testing/prisma-item-ports.harness.ts'
];
for(let file of harnessFiles) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/status: 'dispatched'/g, "status: 'dispatched', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0");
  text = text.replace(/total: amount,/g, "total: amount, currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0,");
  text = text.replace(/status: 'confirmed'/g, "status: 'confirmed', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, amountVes: 0");
  text = text.replace(/status: 'draft'/g, "status: 'draft', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, amountVes: 0");
  fs.writeFileSync(file, text);
}

const scenarioFiles = [
  'apps/api/src/contexts/sales/application/testing/sales-scenario.ts',
  'apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts'
];
for(let file of scenarioFiles) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/calendar\),/g, "calendar, rates),");
  fs.writeFileSync(file, text);
}

let motherFile = 'apps/api/src/contexts/sales/domain/testing/sales.mother.ts';
let motherText = fs.readFileSync(motherFile, 'utf8');
motherText = motherText.replace(/notes: null,/g, "notes: null, currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false } as any,");
fs.writeFileSync(motherFile, motherText);

let entityFile = 'apps/api/src/contexts/sales/domain/order/sales-order.entity.spec.ts';
let entityText = fs.readFileSync(entityFile, 'utf8');
entityText = entityText.replace(/notes: null/g, "notes: null, currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false } as any");
fs.writeFileSync(entityFile, entityText);

let dispatchFile = 'apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.spec.ts';
let dispatchText = fs.readFileSync(dispatchFile, 'utf8');
dispatchText = dispatchText.replace(/notes: null,/g, "notes: null, currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false } as any,");
fs.writeFileSync(dispatchFile, dispatchText);

let salesPorts = 'apps/api/src/contexts/sales/testing/sales-ports.contract.ts';
let salesPortsText = fs.readFileSync(salesPorts, 'utf8');
salesPortsText = salesPortsText.replace(/notes: null/g, "notes: null, currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false } as any");
fs.writeFileSync(salesPorts, salesPortsText);

