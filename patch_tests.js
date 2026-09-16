const fs = require('fs');

const fakeCurr = "currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false,";
const fakeCurrVes = "currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0,";
const fakePayVes = "currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false, amountVes: 0,";

function globalPatch(path) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/notes: null,/g, "notes: null, " + fakeCurr);
    content = content.replace(/notes: 'Test',/g, "notes: 'Test', " + fakeCurr);
    content = content.replace(/warehouseId: row\.warehouseId,/g, "warehouseId: row.warehouseId, " + fakeCurr);
    content = content.replace(/orderId: row\.orderId,/g, "orderId: row.orderId, " + fakeCurr);
    
    // For seeds
    content = content.replace(/status: 'draft',/g, "status: 'draft', " + fakeCurr);
    content = content.replace(/status: 'issued',/g, "status: 'issued', " + fakeCurrVes);
    content = content.replace(/status: 'confirmed',/g, "status: 'confirmed', " + fakePayVes);
    
    fs.writeFileSync(path, content);
  }
}

globalPatch('apps/api/prisma/seed.ts');
globalPatch('apps/api/src/contexts/inventory/infrastructure/testing/prisma-item-ports.harness.ts');
globalPatch('apps/api/src/contexts/receivables/infrastructure/testing/prisma-receivables-ports.harness.ts');
globalPatch('apps/api/src/contexts/reporting/infrastructure/testing/prisma-reporting-read-model.harness.ts');
globalPatch('apps/api/src/contexts/sales/infrastructure/testing/prisma-sales-ports.harness.ts');
globalPatch('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.spec.ts');
globalPatch('apps/api/src/contexts/sales/domain/order/sales-order.entity.spec.ts');
