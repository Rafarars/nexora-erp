const fs = require('fs');
let content = fs.readFileSync('apps/api/prisma/schema.prisma', 'utf8');

const currProps = `
  currency           String    @db.Char(3)
  exchangeRate       Decimal?  @map("exchange_rate") @db.Decimal(18, 8)
  baseCurrency       String    @map("base_currency") @db.Char(3)
  baseExchangeRate   Decimal?  @map("base_exchange_rate") @db.Decimal(18, 8)
  manualExchangeRate Boolean   @default(false) @map("manual_exchange_rate")`;

// SalesOrder
if (!content.match(/model SalesOrder \{[^{]*?currency           String/)) {
    content = content.replace(
      '  updatedAt   DateTime         @updatedAt @map("updated_at")',
      '  updatedAt   DateTime         @updatedAt @map("updated_at")' + currProps
    );
}

// Dispatch
if (!content.match(/model Dispatch \{[^{]*?currency           String/)) {
    content = content.replace(
      '  updatedAt    DateTime       @updatedAt @map("updated_at")',
      '  updatedAt    DateTime       @updatedAt @map("updated_at")' + currProps
    );
}

// Invoice
const invVes = `
  subtotalVes        Decimal?  @map("subtotal_ves") @db.Decimal(18, 4)
  taxVes             Decimal?  @map("tax_ves") @db.Decimal(18, 4)
  totalVes           Decimal?  @map("total_ves") @db.Decimal(18, 4)`;
if (!content.match(/model Invoice \{[^{]*?currency           String/)) {
    content = content.replace(
      '  updatedAt   DateTime      @updatedAt @map("updated_at")',
      '  updatedAt   DateTime      @updatedAt @map("updated_at")' + currProps + invVes
    );
}

// CustomerPayment
const payVes = `
  amountVes          Decimal?  @map("amount_ves") @db.Decimal(18, 4)`;
if (!content.match(/model CustomerPayment \{[^{]*?currency           String/)) {
    content = content.replace(
      '  updatedAt   DateTime      @updatedAt @map("updated_at")',
      '  updatedAt   DateTime      @updatedAt @map("updated_at")' + currProps + payVes
    );
}

// PaymentAllocation
const allocDiff = `
  exchangeDifference Decimal    @default(0) @map("exchange_difference") @db.Decimal(18, 4)`;
if (!content.match(/model PaymentAllocation \{[^{]*?exchangeDifference/)) {
    content = content.replace(
      '  amount    Decimal  @db.Decimal(18, 4)',
      '  amount    Decimal  @db.Decimal(18, 4)' + allocDiff
    );
}

fs.writeFileSync('apps/api/prisma/schema.prisma', content);
