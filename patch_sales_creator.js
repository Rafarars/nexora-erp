const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/sales/application/create-order/sales-order-creator.ts', 'utf8');

file = file.replace(
  'import { SalesDate } from \'../../domain/shared/sales-date.vo.js\';',
  'import { SalesDate } from \'../../domain/shared/sales-date.vo.js\';\nimport { DocumentRates } from \'../../../../shared/domain/ports/document-rates.js\';\nimport { DocumentCurrency } from \'../../domain/shared/document-currency.js\';'
);

file = file.replace(
  'export interface SalesOrderInput {',
  'export interface SalesOrderInput {\n  currency?: string | null;\n  exchangeRate?: number | null;'
);

file = file.replace(
  'export async function salesOrderDetails(\n  references: SalesOrderReferences,\n  tenantId: TenantId,\n  input: SalesOrderInput,\n  today: string,\n): Promise<SalesOrderDetails> {',
  'export async function salesOrderDetails(\n  references: SalesOrderReferences,\n  rates: DocumentRates,\n  tenantId: TenantId,\n  input: SalesOrderInput,\n  today: string,\n  keepsCurrency = false,\n): Promise<SalesOrderDetails> {'
);

const newDetails = `  const orderDate = input.date ? SalesDate.of(input.date) : SalesDate.of(today);
  const resolved = {
    customerId: await references.customer(tenantId, input.customerId),
    warehouseId: await references.warehouse(tenantId, input.warehouseId),
    orderDate,
    notes: input.notes ?? null,
    lines: await references.lines(tenantId, input.lines),
  };

  orderDate.ensureNotAfter(today);

  const currency = await rates.forDocument(tenantId.value, {
    currency: input.currency,
    date: orderDate.value,
    manualRate: input.exchangeRate,
    keepsCurrency,
  });

  return { ...resolved, currency: DocumentCurrency.of(currency) };`;

file = file.replace(
  /  return \{\n    customerId: await references\.customer\(tenantId, input\.customerId\),\n    warehouseId: await references\.warehouse\(tenantId, input\.warehouseId\),\n    orderDate: input\.date \? SalesDate\.of\(input\.date\) : SalesDate\.of\(today\),\n    notes: input\.notes \?\? null,\n    lines: await references\.lines\(tenantId, input\.lines\),\n  \};/,
  newDetails
);

file = file.replace(
  '    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n  ) {}',
  '    private readonly clock: Clock,\n    private readonly calendar: BusinessCalendar,\n    private readonly rates: DocumentRates,\n  ) {}'
);

file = file.replace(
  '    const details = await salesOrderDetails(this.references, tenantId, request, today);',
  '    const details = await salesOrderDetails(this.references, this.rates, tenantId, request, today);'
);

fs.writeFileSync('apps/api/src/contexts/sales/application/create-order/sales-order-creator.ts', file);
