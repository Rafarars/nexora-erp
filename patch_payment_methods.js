const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/receivables/domain/payment/customer-payment.entity.ts', 'utf8');

file = file.replace(
  '  allocations: PaymentAllocationPrimitives[];\n}',
  '  allocations: PaymentAllocationPrimitives[];\n  currency: DocumentCurrency;\n}'
);

file = file.replace(
  "  static draft(id: PaymentId, tenantId: TenantId, code: string, details: PaymentDetails, now: Date, today: string): CustomerPayment {\n    return new CustomerPayment({\n      id: id.value,\n      tenantId: tenantId.value,\n      code,\n      ...validated(details, today),\n      status: 'draft',",
  "  static draft(id: PaymentId, tenantId: TenantId, code: string, details: PaymentDetails, now: Date, today: string): CustomerPayment {\n    return new CustomerPayment({\n      id: id.value,\n      tenantId: tenantId.value,\n      code,\n      ...validated(details, today),\n      ...details.currency.toPrimitives(),\n      amountVes: null,\n      status: 'draft',"
);

file = file.replace(
  "type Body = Pick<PaymentPrimitives, 'customerId' | 'paymentDate' | 'method' | 'reference' | 'notes' | 'amount' | 'allocations'>;",
  "type Body = Pick<PaymentPrimitives, 'customerId' | 'paymentDate' | 'method' | 'reference' | 'notes' | 'amount' | 'allocations'>;"
);

// Exchange difference in confirm
file = file.replace(
  "  confirm(invoices: ReceivableInvoice[], now: Date, today: string): void {\n    if (this.row.status !== 'draft') throw new PaymentNotConfirmableError(this.row.id, this.row.status);\n\n    ReceivablesDate.of(this.row.paymentDate).ensureNotAfter(today);\n    this.ensureFits(invoices);",
  "  confirm(invoices: ReceivableInvoice[], now: Date, today: string): void {\n    if (this.row.status !== 'draft') throw new PaymentNotConfirmableError(this.row.id, this.row.status);\n\n    ReceivablesDate.of(this.row.paymentDate).ensureNotAfter(today);\n    this.ensureFits(invoices);\n\n    if (this.row.exchangeRate) {\n      this.row.amountVes = Math.round(this.row.amount * this.row.exchangeRate * 10000) / 10000;\n      this.row.allocations = this.row.allocations.map((a) => {\n        const inv = invoices.find(i => i.id().value === a.invoiceId);\n        if (inv && inv.toPrimitives().exchangeRate) {\n          a.exchangeDifference = Math.round(((a.amount * this.row.exchangeRate) - (a.amount * inv.toPrimitives().exchangeRate)) * 10000) / 10000;\n        }\n        return a;\n      });\n    }"
);

fs.writeFileSync('apps/api/src/contexts/receivables/domain/payment/customer-payment.entity.ts', file);
