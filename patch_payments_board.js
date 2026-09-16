const fs = require('fs');

let file = fs.readFileSync('apps/web/src/sections/receivables/payments-board.tsx', 'utf8');

file = file.replace(
  "import { formatAmount } from '@/modules/purchasing/domain/purchasing';",
  "import { formatAmount } from '@/modules/sales/domain/sales';\nimport { AmountDual } from '@/shared/components/amount-dual';"
);

file = file.replace(
  "<td className=\"p-3 pr-4 text-right tabular-nums\">{formatAmount(payment.amount)}</td>",
  "<td className=\"p-3 pr-4 text-right tabular-nums\"><AmountDual amount={payment.amount} amountVes={payment.amountVes} currency={payment.currency} /></td>"
);

fs.writeFileSync('apps/web/src/sections/receivables/payments-board.tsx', file);
