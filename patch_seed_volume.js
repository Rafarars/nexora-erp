const fs = require('fs');

let file = fs.readFileSync('apps/api/prisma/seed.ts', 'utf8');

const currSqlCols = ", currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate";
const currSqlVals = ", 'USD', 1, 'USD', 1, false";

const vesInvCols = ", subtotal_ves, tax_ves, total_ves";
const vesInvVals = ", 0, 0, 0";

const vesPayCols = ", amount_ves";
const vesPayVals = ", 0";

file = file.replace(
  "confirmed_at, updated_at)",
  `confirmed_at, updated_at${currSqlCols})`
);
file = file.replace(
  "date '2026-01-01' + (n % 250), 'dispatched'::sales_order_status, now(), now()",
  `date '2026-01-01' + (n % 250), 'dispatched'::sales_order_status, now(), now()${currSqlVals}`
);

file = file.replace(
  "date '2026-01-01' + (n % 250), 'confirmed'::dispatch_status, now(), now()",
  `date '2026-01-01' + (n % 250), 'confirmed'::dispatch_status, now(), now()${currSqlVals}`
);

file = file.replace(
  "status, confirmed_at, updated_at)",
  `status, confirmed_at, updated_at${currSqlCols})`
);

file = file.replace(
  "total, updated_at)",
  `total, updated_at${currSqlCols}${vesInvCols})`
);
file = file.replace(
  "status, subtotal, tax, total, updated_at)",
  `status, subtotal, tax, total, updated_at${currSqlCols}${vesInvCols})`
);
file = file.replace(
  "16, 116, now()",
  `16, 116, now()${currSqlVals}${vesInvVals}`
);

file = file.replace(
  "amount, updated_at)",
  `amount, updated_at${currSqlCols}${vesPayCols})`
);
file = file.replace(
  "status, amount, updated_at)",
  `status, amount, updated_at${currSqlCols}${vesPayCols})`
);
file = file.replace(
  "method, status, amount, updated_at)",
  `method, status, amount, updated_at${currSqlCols}${vesPayCols})`
);
file = file.replace(
  "'confirmed'::customer_payment_status, 116, now()",
  `'confirmed'::customer_payment_status, 116, now()${currSqlVals}${vesPayVals}`
);

fs.writeFileSync('apps/api/prisma/seed.ts', file);
