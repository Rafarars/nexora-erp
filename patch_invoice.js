const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/sales/domain/invoice/invoice.entity.ts', 'utf8');

file = file.replace(
  'import { baseToNumber, lineSubtotalBase, taxBase } from \'../shared/money.js\';',
  'import { baseToNumber, lineSubtotalBase, taxBase } from \'../shared/money.js\';\nimport { DocumentCurrency, DocumentCurrencyPrimitives } from \'../shared/document-currency.js\';'
);

file = file.replace(
  'export interface InvoicePrimitives {',
  'export interface InvoicePrimitives extends DocumentCurrencyPrimitives {'
);

file = file.replace(
  '  total: number;\n  cancelledAt: Date | null;\n  createdAt: Date;\n  updatedAt: Date;\n  lines: InvoiceLinePrimitives[];\n}',
  '  total: number;\n  subtotalVes: number | null;\n  taxVes: number | null;\n  totalVes: number | null;\n  cancelledAt: Date | null;\n  createdAt: Date;\n  updatedAt: Date;\n  lines: InvoiceLinePrimitives[];\n}'
);

file = file.replace(
  '  date: SalesDate;\n  notes: string | null;\n  lineIds: () => string;\n}',
  '  date: SalesDate;\n  currency: DocumentCurrency;\n  notes: string | null;\n  lineIds: () => string;\n}'
);

const newInvoiceInit = `    const currency = issue.currency;
    const isVes = currency.baseCurrency === 'VES' || currency.currency === 'VES';
    const subtotalVes = currency.exchangeRate ? baseToNumber(subtotal) * currency.exchangeRate : null;
    const taxVes = currency.exchangeRate ? baseToNumber(tax) * currency.exchangeRate : null;
    
    return new Invoice({
      id: id.value,
      tenantId: tenantId.value,
      code,
      dispatchId: dispatch.id.value,
      orderId: order.id.value,
      customerId: order.customerId().value,
      issueDate: issue.date.value,
      dueDate: issue.date.plusDays(issue.credit.paymentTermDays).value,
      ...currency.toPrimitives(),
      notes: optionalText(issue.notes, 500, 'InvoiceNotes'),
      status: 'issued',
      subtotal: baseToNumber(subtotal),
      tax: baseToNumber(tax),
      total: baseToNumber(subtotal + tax),
      subtotalVes,
      taxVes,
      totalVes: subtotalVes !== null && taxVes !== null ? subtotalVes + taxVes : null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,`;

file = file.replace(
  '    return new Invoice({\n      id: id.value,\n      tenantId: tenantId.value,\n      code,\n      dispatchId: dispatch.id.value,\n      orderId: order.id.value,\n      customerId: order.customerId().value,\n      issueDate: issue.date.value,\n      dueDate: issue.date.plusDays(issue.credit.paymentTermDays).value,\n      notes: optionalText(issue.notes, 500, \'InvoiceNotes\'),\n      status: \'issued\',\n      subtotal: baseToNumber(subtotal),\n      tax: baseToNumber(tax),\n      total: baseToNumber(subtotal + tax),\n      cancelledAt: null,\n      createdAt: now,\n      updatedAt: now,',
  newInvoiceInit
);

fs.writeFileSync('apps/api/src/contexts/sales/domain/invoice/invoice.entity.ts', file);
