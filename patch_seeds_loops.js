const fs = require('fs');
let file = fs.readFileSync('apps/api/prisma/seed.ts', 'utf8');

const baseCurr = `currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualExchangeRate: false`;

file = file.replace(
  `data: { ...order, createdAt: order.orderDate, updatedAt: order.confirmedAt ?? order.orderDate }`,
  `data: { ...order, ${baseCurr}, createdAt: order.orderDate, updatedAt: order.confirmedAt ?? order.orderDate }`
);

file = file.replace(
  `data: { ...dispatch, createdAt: dispatch.dispatchDate, updatedAt: dispatch.confirmedAt ?? dispatch.dispatchDate }`,
  `data: { ...dispatch, ${baseCurr}, createdAt: dispatch.dispatchDate, updatedAt: dispatch.confirmedAt ?? dispatch.dispatchDate }`
);

file = file.replace(
  `data: { ...payment, createdAt: payment.paymentDate, updatedAt: payment.confirmedAt ?? payment.paymentDate }`,
  `data: { ...payment, ${baseCurr}, amountVes: 0, createdAt: payment.paymentDate, updatedAt: payment.confirmedAt ?? payment.paymentDate }`
);

// Payment allocations (exchange_difference)
file = file.replace(
  `data: { ...allocation, tenantId: payment.tenantId, paymentId: payment.id }`,
  `data: { ...allocation, tenantId: payment.tenantId, paymentId: payment.id, exchangeDifference: 0 }`
);

fs.writeFileSync('apps/api/prisma/seed.ts', file);
