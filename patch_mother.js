const fs = require('fs');
let content = fs.readFileSync('apps/api/src/contexts/sales/domain/testing/sales.mother.ts', 'utf8');

content = content.replace(
  'import { SalesOrder, SalesOrderId } from \'../order/sales-order.entity.js\';',
  'import { SalesOrder, SalesOrderId } from \'../order/sales-order.entity.js\';\nimport { DocumentCurrency } from \'../shared/document-currency.js\';'
);

content = content.replace(
  '    orderDate: SalesDate.of(TODAY),\n    notes: null,\n    lines: []',
  '    orderDate: SalesDate.of(TODAY),\n    currency: DocumentCurrency.fromPrimitives({ currency: \'USD\', exchangeRate: null, baseCurrency: \'USD\', baseExchangeRate: null, manualExchangeRate: false }),\n    notes: null,\n    lines: []'
);

fs.writeFileSync('apps/api/src/contexts/sales/domain/testing/sales.mother.ts', content);
