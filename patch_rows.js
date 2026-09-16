const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/receivables/infrastructure/persistence/receivables-rows.ts', 'utf8');

const currProps = `
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  amountVes: Decimalish | null;`;

file = file.replace(
  '  amount: Decimalish;\n  status: PaymentStatus;',
  `  amount: Decimalish;\n${currProps}\n  status: PaymentStatus;`
);

file = file.replace(
  "  allocations: { id: string; invoiceId: string; amount: Decimalish }[];\n}",
  "  allocations: { id: string; invoiceId: string; amount: Decimalish; exchangeDifference: Decimalish }[];\n}"
);

file = file.replace(
  "    amount: row.amount.toNumber(),\n    allocations: row.allocations.map((allocation) => ({ id: allocation.id, invoiceId: allocation.invoiceId, amount: allocation.amount.toNumber() })),",
  "    amount: row.amount.toNumber(),\n    exchangeRate: row.exchangeRate ? row.exchangeRate.toNumber() : null,\n    baseExchangeRate: row.baseExchangeRate ? row.baseExchangeRate.toNumber() : null,\n    amountVes: row.amountVes ? row.amountVes.toNumber() : null,\n    allocations: row.allocations.map((allocation) => ({ id: allocation.id, invoiceId: allocation.invoiceId, amount: allocation.amount.toNumber(), exchangeDifference: allocation.exchangeDifference.toNumber() })),"
);

// invoiceSelect
file = file.replace(
  "    status: true,\n    total: true,",
  "    status: true,\n    total: true,\n    exchangeRate: true,"
);

file = file.replace(
  "  total: Decimalish;\n  allocations: { amount: Decimalish }[];",
  "  total: Decimalish;\n  exchangeRate: Decimalish | null;\n  allocations: { amount: Decimalish }[];"
);

file = file.replace(
  "  const paidBase = row.allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount.toNumber() * 100), 0);\n\n  return ReceivableInvoice.of({\n    id: row.id,\n    code: row.code,\n    customerId: row.customerId,\n    issueDate: day(row.issueDate),\n    dueDate: day(row.dueDate),\n    status: row.status,\n    total: row.total.toNumber(),\n    paid: paidBase / 100,\n  });",
  "  const paidBase = row.allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount.toNumber() * 10000), 0);\n\n  return ReceivableInvoice.of({\n    id: row.id,\n    code: row.code,\n    customerId: row.customerId,\n    issueDate: day(row.issueDate),\n    dueDate: day(row.dueDate),\n    status: row.status,\n    total: row.total.toNumber(),\n    exchangeRate: row.exchangeRate ? row.exchangeRate.toNumber() : null,\n    paid: paidBase / 10000,\n  });"
);

fs.writeFileSync('apps/api/src/contexts/receivables/infrastructure/persistence/receivables-rows.ts', file);
