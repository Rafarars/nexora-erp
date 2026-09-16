const fs = require('fs');
let file = fs.readFileSync('apps/api/prisma/seed.ts', 'utf8');

const fakeCurr = "currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false";

file = file.replace(
  /notes: 'Pedido semanal',/g,
  `notes: 'Pedido semanal', \${fakeCurr},`
);

file = file.replace(
  /notes: 'Primera entrega',/g,
  `notes: 'Primera entrega', \${fakeCurr},`
);

file = file.replace(
  /notes: 'Abono factura parcial',/g,
  `notes: 'Abono factura parcial', \${fakeCurr}, amountVes: 0,`
);

file = file.replace(
  /notes: 'Pago completo',/g,
  `notes: 'Pago completo', \${fakeCurr}, amountVes: 0,`
);

fs.writeFileSync('apps/api/prisma/seed.ts', file);
