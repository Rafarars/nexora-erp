const fs = require('fs');

// 1. receivables-scenario.ts: fix duplicate 'rates'
let fReceivablesScenario = 'apps/api/src/contexts/receivables/application/testing/receivables-scenario.ts';
let tReceivablesScenario = fs.readFileSync(fReceivablesScenario, 'utf8');
tReceivablesScenario = tReceivablesScenario.replace(/, rates, rates\)/g, ', rates)');
tReceivablesScenario = tReceivablesScenario.replace(/, rates\), rates\)/g, ', rates)');
fs.writeFileSync(fReceivablesScenario, tReceivablesScenario);

// 2. sales-scenario.ts: remove 'rates' from DispatchCreator, DispatchUpdater, InvoiceIssuer
let fSalesScenario = 'apps/api/src/contexts/sales/application/testing/sales-scenario.ts';
let tSalesScenario = fs.readFileSync(fSalesScenario, 'utf8');
tSalesScenario = tSalesScenario.replace(/new DispatchCreator\((.*?), rates\)/g, 'new DispatchCreator($1)');
tSalesScenario = tSalesScenario.replace(/new DispatchUpdater\((.*?), rates\)/g, 'new DispatchUpdater($1)');
tSalesScenario = tSalesScenario.replace(/new InvoiceIssuer\((.*?), rates\)/g, 'new InvoiceIssuer($1)');
// Also remove extra rates if any
tSalesScenario = tSalesScenario.replace(/, rates, rates\)/g, ', rates)');
tSalesScenario = tSalesScenario.replace(/, rates\), rates\)/g, ', rates)');
fs.writeFileSync(fSalesScenario, tSalesScenario);

// 3. update-payment/payment-updater.ts: fix allocations
let fPaymentUpdater = 'apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts';
let tPaymentUpdater = fs.readFileSync(fPaymentUpdater, 'utf8');
tPaymentUpdater = tPaymentUpdater.replace(/id: this\.ids\.next\(\),\n\s*\.\.\.allocation\n\s*\}\)\),/g, 'id: this.ids.next(),\n        ...allocation,\n        exchangeDifference: 0\n      })),');
// just to be safe if it's on one line
tPaymentUpdater = tPaymentUpdater.replace(/id: this.ids.next\(\), \.\.\.allocation \}\)\),/g, 'id: this.ids.next(), ...allocation, exchangeDifference: 0 })),');
fs.writeFileSync(fPaymentUpdater, tPaymentUpdater);

// 4. receivables.module.ts
let fReceivablesModule = 'apps/api/src/contexts/receivables/infrastructure/receivables.module.ts';
let tReceivablesModule = fs.readFileSync(fReceivablesModule, 'utf8');
tReceivablesModule = tReceivablesModule.replace(/import \{ DocumentRates \} from '..\/..\/..\/..\/shared\/domain\/ports\/document-rates.js';\nimport \{ DocumentRates \}/g, 'import { DocumentRates }');
fs.writeFileSync(fReceivablesModule, tReceivablesModule);

// 5. fix harnesses manually
function fixHarness(file) {
    let t = fs.readFileSync(file, 'utf8');
    // Remove all currency, baseCurrency, etc. to start clean
    t = t.replace(/, currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false/g, '');
    t = t.replace(/, subtotalVes: 0, taxVes: 0, totalVes: 0/g, '');
    t = t.replace(/, amountVes: 0/g, '');
    t = t.replace(/, exchangeDifference: 0/g, '');
    
    // Now add them back carefully
    const currFields = ", currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false";
    const vesFields = ", subtotalVes: 0, taxVes: 0, totalVes: 0";
    const fullInvoice = currFields + vesFields;
    const fullPayment = currFields + ", amountVes: 0";
    
    t = t.replace(/status: 'dispatched'/g, "status: 'dispatched'" + fullInvoice);
    t = t.replace(/total: invoice\.total,/g, "total: invoice.total" + fullInvoice + ",");
    t = t.replace(/total: amount,/g, "total: amount" + fullInvoice + ",");
    t = t.replace(/status: 'confirmed'/g, "status: 'confirmed'" + fullPayment);
    t = t.replace(/status: 'draft'/g, "status: 'draft'" + fullPayment);
    t = t.replace(/status: order\.status/g, "status: order.status" + fullInvoice);

    // Some places might have multiple matches, let's fix reporting specific lines
    fs.writeFileSync(file, t);
}

fixHarness('apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts');
fixHarness('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts');
fixHarness('apps/api/src/contexts/inventory/infrastructure/testing/prisma-item-ports.harness.ts');

// 6. fix spec files missing currency
const currObj = `currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false, toPrimitives: () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false }) } as any`;

function patchSpec(file, search, replace) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(currObj)) {
      text = text.replace(search, replace);
  } else {
      // already replaced
  }
  fs.writeFileSync(file, text);
}

// sales-order.entity.spec.ts
patchSpec('apps/api/src/contexts/sales/domain/order/sales-order.entity.spec.ts',
  'notes: null, lines',
  `notes: null, ${currObj}, lines`
);

// dispatch.entity.spec.ts
patchSpec('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.spec.ts',
  'notes: null, lines',
  `notes: null, ${currObj}, lines`
);
patchSpec('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.spec.ts',
  'notes: null, lineIds',
  `notes: null, ${currObj}, lineIds`
);

// sales-ports.contract.ts
patchSpec('apps/api/src/contexts/sales/testing/sales-ports.contract.ts',
  "notes: 'Urgente', lines",
  `notes: 'Urgente', ${currObj}, lines`
);
patchSpec('apps/api/src/contexts/sales/testing/sales-ports.contract.ts',
  'notes: null, lines',
  `notes: null, ${currObj}, lines`
);
patchSpec('apps/api/src/contexts/sales/testing/sales-ports.contract.ts',
  'notes: null, lineIds',
  `notes: null, ${currObj}, lineIds`
);

// receivables-ports.contract.ts
patchSpec('apps/api/src/contexts/receivables/testing/receivables-ports.contract.ts',
  "method: 'transfer', reference",
  `method: 'transfer', ${currObj}, reference`
);

