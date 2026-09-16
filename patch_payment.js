const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/receivables/domain/payment/customer-payment.entity.ts', 'utf8');

file = file.replace(
  "  currency: DocumentCurrency;\n}\n\nexport interface PaymentDetails {",
  "}\n\nexport interface PaymentDetails {"
);

file = file.replace(
  "  allocations: PaymentAllocationPrimitives[];\n}\n\ntype Body",
  "  allocations: PaymentAllocationPrimitives[];\n  currency: DocumentCurrency;\n}\n\ntype Body"
);

fs.writeFileSync('apps/api/src/contexts/receivables/domain/payment/customer-payment.entity.ts', file);
