const fs = require('fs');

const currObj = `currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false, toPrimitives: () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false }) } as any`;

function patchFile(file, search, replace) {
  let text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.replace(search, replace));
}

// sales.mother.ts
patchFile('apps/api/src/contexts/sales/domain/testing/sales.mother.ts',
  'notes: null,\n    lines',
  `notes: null,\n    ${currObj},\n    lines`
);

// sales-order.entity.spec.ts
patchFile('apps/api/src/contexts/sales/domain/order/sales-order.entity.spec.ts',
  'notes: null, lines',
  `notes: null, ${currObj}, lines`
);

// dispatch.entity.spec.ts
patchFile('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.spec.ts',
  'notes: null, lines',
  `notes: null, ${currObj}, lines`
);
patchFile('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.spec.ts',
  'notes: null, lineIds',
  `notes: null, ${currObj}, lineIds`
);

// sales-ports.contract.ts
patchFile('apps/api/src/contexts/sales/testing/sales-ports.contract.ts',
  "notes: 'Urgente', lines",
  `notes: 'Urgente', ${currObj}, lines`
);
patchFile('apps/api/src/contexts/sales/testing/sales-ports.contract.ts',
  'notes: null, lines',
  `notes: null, ${currObj}, lines`
);
patchFile('apps/api/src/contexts/sales/testing/sales-ports.contract.ts',
  'notes: null, lineIds',
  `notes: null, ${currObj}, lineIds`
);

// receivables-ports.contract.ts
patchFile('apps/api/src/contexts/receivables/testing/receivables-ports.contract.ts',
  "method: 'transfer', reference",
  `method: 'transfer', ${currObj}, reference`
);

// payment-updater.ts
patchFile('apps/api/src/contexts/receivables/application/update-payment/payment-updater.ts',
  'allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation })),',
  'allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation, exchangeDifference: 0 })),'
);
