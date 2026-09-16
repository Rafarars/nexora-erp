const fs = require('fs');
let content = fs.readFileSync('apps/api/src/contexts/sales/infrastructure/sales.module.ts', 'utf8');

// Ensure import
if (!content.includes('DOCUMENT_RATES')) {
  content = content.replace(
    'import { BUSINESS_CALENDAR }',
    'import { DOCUMENT_RATES } from \'../../../shared/domain/ports/document-rates.js\';\nimport type { DocumentRates } from \'../../../shared/domain/ports/document-rates.js\';\nimport { BUSINESS_CALENDAR }'
  );
}

// SalesOrderCreator
content = content.replace(
  '      useFactory: (x: SalesOrderReferences, r: SalesOrderRepository, c: SalesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar) => new SalesOrderCreator(x, r, c, i, k, cal),\n      inject: [SalesOrderReferences, SALES_ORDER_REPOSITORY, SALES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR],',
  '      useFactory: (x: SalesOrderReferences, r: SalesOrderRepository, c: SalesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new SalesOrderCreator(x, r, c, i, k, cal, dr),\n      inject: [SalesOrderReferences, SALES_ORDER_REPOSITORY, SALES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],'
);

// SalesOrderUpdater
content = content.replace(
  '      useFactory: (f: SalesOrderFinder, x: SalesOrderReferences, r: SalesOrderRepository, k: Clock, cal: BusinessCalendar) => new SalesOrderUpdater(f, x, r, k, cal),\n      inject: [SalesOrderFinder, SalesOrderReferences, SALES_ORDER_REPOSITORY, CLOCK, BUSINESS_CALENDAR],',
  '      useFactory: (f: SalesOrderFinder, x: SalesOrderReferences, r: SalesOrderRepository, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new SalesOrderUpdater(f, x, r, k, cal, dr),\n      inject: [SalesOrderFinder, SalesOrderReferences, SALES_ORDER_REPOSITORY, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],'
);

// SalesOrderConfirmer
content = content.replace(
  '      useFactory: (f: SalesOrderFinder, x: SalesOrderReferences, r: SalesOrderRepository, p: SalesOrderPosting, s: StockReservation, k: Clock, cal: BusinessCalendar) =>\n        new SalesOrderConfirmer(f, x, r, p, s, k, cal),\n      inject: [SalesOrderFinder, SalesOrderReferences, SALES_ORDER_REPOSITORY, SALES_ORDER_POSTING, StockReservation, CLOCK, BUSINESS_CALENDAR],',
  '      useFactory: (f: SalesOrderFinder, x: SalesOrderReferences, r: SalesOrderRepository, p: SalesOrderPosting, s: StockReservation, k: Clock, cal: BusinessCalendar, dr: DocumentRates) =>\n        new SalesOrderConfirmer(f, x, r, p, s, k, cal, dr),\n      inject: [SalesOrderFinder, SalesOrderReferences, SALES_ORDER_REPOSITORY, SALES_ORDER_POSTING, StockReservation, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],'
);

fs.writeFileSync('apps/api/src/contexts/sales/infrastructure/sales.module.ts', content);
