const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/infrastructure/receivables.module.ts', 'utf8');

file = file.replace(
  "import { DocumentRateResolver } from '../../shared/infrastructure/document-rate-resolver.js';",
  "import { DocumentRateResolver } from '../../shared/infrastructure/document-rate-resolver.js';\nimport { DocumentRates } from '../../shared/domain/ports/document-rates.js';"
);

file = file.replace(
  "useFactory: (l: ReceivablesLedger, r: PaymentRepository, c: ReceivablesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar) => new PaymentCreator(l, r, c, i, k, cal),",
  "useFactory: (l: ReceivablesLedger, r: PaymentRepository, c: ReceivablesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new PaymentCreator(l, r, c, i, k, cal, dr),"
);

file = file.replace(
  "inject: [ReceivablesLedger, PaymentRepository, ReceivablesCodeSequence, IdGenerator, Clock, BusinessCalendar],",
  "inject: [ReceivablesLedger, PaymentRepository, ReceivablesCodeSequence, IdGenerator, Clock, BusinessCalendar, DocumentRateResolver],"
);

file = file.replace(
  "useFactory: (r: PaymentRepository, i: IdGenerator, c: Clock, cal: BusinessCalendar) => new PaymentUpdater(r, i, c, cal),",
  "useFactory: (r: PaymentRepository, i: IdGenerator, c: Clock, cal: BusinessCalendar, dr: DocumentRates) => new PaymentUpdater(r, i, c, cal, dr),"
);

file = file.replace(
  "inject: [PaymentRepository, IdGenerator, Clock, BusinessCalendar],",
  "inject: [PaymentRepository, IdGenerator, Clock, BusinessCalendar, DocumentRateResolver],"
);

fs.writeFileSync('apps/api/src/contexts/receivables/infrastructure/receivables.module.ts', file);
