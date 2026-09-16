const fs = require('fs');

let file = fs.readFileSync('apps/web/src/sections/sales/invoices-board.tsx', 'utf8');

file = file.replace(
  "import { formatQuantity } from '@/modules/inventory/domain/inventory';",
  "import { formatQuantity } from '@/modules/inventory/domain/inventory';\nimport { AmountDual } from '@/shared/components/amount-dual';"
);

file = file.replace(
  "<td className=\"p-3 pr-4 text-right tabular-nums\">{formatAmount(invoice.total)}</td>",
  "<td className=\"p-3 pr-4 text-right tabular-nums\"><AmountDual amount={invoice.total} amountVes={invoice.totalVes} currency={invoice.currency} /></td>"
);

fs.writeFileSync('apps/web/src/sections/sales/invoices-board.tsx', file);
