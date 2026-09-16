const fs = require('fs');
let file = fs.readFileSync('apps/api/prisma/seed.ts', 'utf8');

file = file.replace(
  "10 + n % 90, 0, 10 + n % 90, now()\n    FROM generate_series",
  "10 + n % 90, 0, 10 + n % 90, now(), 'USD', 1, 'USD', 1, false, 0, 0, 0\n    FROM generate_series"
);

file = file.replace(
  "INSERT INTO customer_payments (id, tenant_id, code, customer_id, payment_date, method, amount, status, confirmed_at, updated_at)",
  "INSERT INTO customer_payments (id, tenant_id, code, customer_id, payment_date, method, amount, status, confirmed_at, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate, amount_ves)"
);
file = file.replace(
  "date '2026-01-10' + (n % 250), 'transfer', 10 + n % 90, 'confirmed'::customer_payment_status, now(), now()",
  "date '2026-01-10' + (n % 250), 'transfer', 10 + n % 90, 'confirmed'::customer_payment_status, now(), now(), 'USD', 1, 'USD', 1, false, 0"
);
fs.writeFileSync('apps/api/prisma/seed.ts', file);
