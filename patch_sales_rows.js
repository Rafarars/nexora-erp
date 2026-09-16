const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/sales/infrastructure/persistence/sales-rows.ts', 'utf8');

const currTypes = `  currency: string;\n  exchangeRate: Decimalish | null;\n  baseCurrency: string;\n  baseExchangeRate: Decimalish | null;\n  manualExchangeRate: boolean;`;

file = file.replace(
  '  orderDate: Date;\n  notes: string | null;',
  `  orderDate: Date;\n${currTypes}\n  notes: string | null;`
);

file = file.replace(
  '  dispatchDate: Date;\n  notes: string | null;',
  `  dispatchDate: Date;\n${currTypes}\n  notes: string | null;`
);

file = file.replace(
  '  issueDate: Date;\n  dueDate: Date;\n  notes: string | null;',
  `  issueDate: Date;\n  dueDate: Date;\n${currTypes}\n  notes: string | null;`
);

file = file.replace(
  '  subtotal: Decimalish;\n  tax: Decimalish;\n  total: Decimalish;',
  `  subtotal: Decimalish;\n  tax: Decimalish;\n  total: Decimalish;\n  subtotalVes: Decimalish | null;\n  taxVes: Decimalish | null;\n  totalVes: Decimalish | null;`
);

// Map n(row.exchangeRate)
file = file.replace(
  '    orderDate: day(row.orderDate),',
  '    orderDate: day(row.orderDate),\n    exchangeRate: row.exchangeRate ? n(row.exchangeRate) : null,\n    baseExchangeRate: row.baseExchangeRate ? n(row.baseExchangeRate) : null,'
);

file = file.replace(
  '    dispatchDate: day(row.dispatchDate),',
  '    dispatchDate: day(row.dispatchDate),\n    exchangeRate: row.exchangeRate ? n(row.exchangeRate) : null,\n    baseExchangeRate: row.baseExchangeRate ? n(row.baseExchangeRate) : null,'
);

file = file.replace(
  '    dueDate: day(row.dueDate),\n    subtotal: n(row.subtotal),\n    tax: n(row.tax),\n    total: n(row.total),',
  '    dueDate: day(row.dueDate),\n    exchangeRate: row.exchangeRate ? n(row.exchangeRate) : null,\n    baseExchangeRate: row.baseExchangeRate ? n(row.baseExchangeRate) : null,\n    subtotal: n(row.subtotal),\n    tax: n(row.tax),\n    total: n(row.total),\n    subtotalVes: row.subtotalVes ? n(row.subtotalVes) : null,\n    taxVes: row.taxVes ? n(row.taxVes) : null,\n    totalVes: row.totalVes ? n(row.totalVes) : null,'
);

fs.writeFileSync('apps/api/src/contexts/sales/infrastructure/persistence/sales-rows.ts', file);
