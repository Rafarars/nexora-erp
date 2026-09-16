const fs = require('fs');

// Updater
let updater = fs.readFileSync('apps/api/src/contexts/sales/application/update-order/sales-order-updater.ts', 'utf8');
updater = updater.replace(
  'import { BusinessCalendar } from \'../../../../shared/domain/ports/business-calendar.js\';',
  'import { BusinessCalendar } from \'../../../../shared/domain/ports/business-calendar.js\';\nimport { DocumentRates } from \'../../../../shared/domain/ports/document-rates.js\';'
);
updater = updater.replace(
  '    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n  ) {}',
  '    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n    private readonly rates: DocumentRates,\n  ) {}'
);
updater = updater.replace(
  '    order.update(await salesOrderDetails(this.references, tenantId, request, today), now, today);',
  '    order.update(await salesOrderDetails(this.references, this.rates, tenantId, request, today, true), now, today);'
);
fs.writeFileSync('apps/api/src/contexts/sales/application/update-order/sales-order-updater.ts', updater);

// Confirmer
let confirmer = fs.readFileSync('apps/api/src/contexts/sales/application/confirm-order/sales-order-confirmer.ts', 'utf8');
confirmer = confirmer.replace(
  'import { BusinessCalendar } from \'../../../../shared/domain/ports/business-calendar.js\';',
  'import { BusinessCalendar } from \'../../../../shared/domain/ports/business-calendar.js\';\nimport { DocumentRates } from \'../../../../shared/domain/ports/document-rates.js\';'
);
confirmer = confirmer.replace(
  '    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n  ) {}',
  '    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n    private readonly rates: DocumentRates,\n  ) {}'
);
confirmer = confirmer.replace(
  '      const details = await salesOrderDetails(',
  '      const details = await salesOrderDetails(\n        this.references,\n        this.rates,'
);
confirmer = confirmer.replace(
  '        today,\n      );',
  '        today,\n        true,\n      );'
);
// In confirmer, the original signature was `await salesOrderDetails(this.references, tenantId, row, today)`. 
// So replace the old argument list.
confirmer = confirmer.replace(
  'await salesOrderDetails(\n        this.references,\n        this.rates,\n        tenantId,\n        row,\n        today,\n        true,\n      );',
  'await salesOrderDetails(this.references, this.rates, tenantId, row, today, true);'
);
fs.writeFileSync('apps/api/src/contexts/sales/application/confirm-order/sales-order-confirmer.ts', confirmer);
