const fs = require('fs');

let file = fs.readFileSync('apps/api/src/contexts/receivables/domain/payment/customer-payment.entity.ts', 'utf8');

file = file.replace(
  "    if (this.row.exchangeRate) {\n      this.row.amountVes = Math.round(this.row.amount * this.row.exchangeRate * 10000) / 10000;\n      this.row.allocations = this.row.allocations.map((a) => {\n        const inv = invoices.find(i => i.id.value === a.invoiceId);\n        if (inv && inv.toPrimitives().exchangeRate) {\n          a.exchangeDifference = Math.round(((a.amount * this.row.exchangeRate) - (a.amount * inv.toPrimitives().exchangeRate)) * 10000) / 10000;\n        }\n        return a;\n      });\n    }",
  "    const rate = this.row.exchangeRate;\n    if (rate !== null) {\n      this.row.amountVes = Math.round(this.row.amount * rate * 10000) / 10000;\n      this.row.allocations = this.row.allocations.map((a) => {\n        const inv = invoices.find(i => i.id === a.invoiceId);\n        const invRate = inv?.toPrimitives().exchangeRate;\n        if (invRate !== null && invRate !== undefined) {\n          a.exchangeDifference = Math.round(((a.amount * rate) - (a.amount * invRate)) * 10000) / 10000;\n        }\n        return a;\n      });\n    }"
);

fs.writeFileSync('apps/api/src/contexts/receivables/domain/payment/customer-payment.entity.ts', file);
