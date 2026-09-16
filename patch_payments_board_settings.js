const fs = require('fs');

let file = fs.readFileSync('apps/web/src/sections/receivables/payments-board.tsx', 'utf8');

file = file.replace(
  "import type { Payment, PaymentMethod, Receivable } from '@/modules/receivables/domain/receivables';",
  "import type { Payment, PaymentMethod, Receivable } from '@/modules/receivables/domain/receivables';\nimport type { CompanySettings } from '@/modules/company/domain/company';\nimport { ExchangeRateField } from '@/shared/forms/exchange-rate-field';"
);

file = file.replace(
  "today: string;",
  "settings: CompanySettings;"
);

file = file.replace(
  "today,\n  canCreate",
  "settings,\n  canCreate"
);

file = file.replace(
  "defaultValue={payment?.paymentDate ?? today}",
  "defaultValue={payment?.paymentDate ?? settings.today}"
);

file = file.replace(
  "max={today}",
  "max={settings.today}"
);

file = file.replace(
  "<TextArea\n          id=\"payment-notes\"",
  "<ExchangeRateField\n          currency=\"USD\"\n          baseCurrency={settings.baseCurrency.code}\n          allowsRateOverride={settings.allowsRateOverride}\n          defaultValue={payment?.exchangeRate ?? null}\n          error={state.errors?.manualExchangeRate}\n        />\n        <TextArea\n          id=\"payment-notes\""
);

fs.writeFileSync('apps/web/src/sections/receivables/payments-board.tsx', file);
