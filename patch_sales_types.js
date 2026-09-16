const fs = require('fs');

const currTypes = `
  currency: string;
  exchangeRate: number | null;
  baseCurrency: string;
  baseExchangeRate: number | null;
  manualExchangeRate: boolean;`;

let file = fs.readFileSync('apps/web/src/modules/sales/domain/sales.ts', 'utf8');

file = file.replace(
  '  subtotal: number;\n  tax: number;\n  total: number;',
  `  subtotal: number;\n  tax: number;\n  total: number;\n  totalVes: number | null;\n  subtotalVes: number | null;\n  taxVes: number | null;`
);

file = file.replace(
  '  status: InvoiceStatus;\n  subtotal: number;',
  `  status: InvoiceStatus;\n${currTypes}\n  subtotal: number;`
);

file = file.replace(
  '  notes: string | null;\n  status: SalesOrderStatus;',
  `  notes: string | null;\n${currTypes}\n  status: SalesOrderStatus;`
);

file = file.replace(
  '  notes: string | null;\n  status: DispatchStatus;',
  `  notes: string | null;\n${currTypes}\n  status: DispatchStatus;`
);

fs.writeFileSync('apps/web/src/modules/sales/domain/sales.ts', file);
