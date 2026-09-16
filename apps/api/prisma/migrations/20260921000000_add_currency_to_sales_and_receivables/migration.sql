-- Paso 4: Moneda y tasas en ventas y cobranza, ensanchamiento de importes a 4 decimales

-- Ensanchar importes existentes de 2 a 4 decimales
ALTER TABLE "invoices"
    ALTER COLUMN "subtotal" TYPE DECIMAL(18,4),
    ALTER COLUMN "tax" TYPE DECIMAL(18,4),
    ALTER COLUMN "total" TYPE DECIMAL(18,4);

ALTER TABLE "invoice_lines"
    ALTER COLUMN "subtotal" TYPE DECIMAL(18,4),
    ALTER COLUMN "tax" TYPE DECIMAL(18,4);

ALTER TABLE "customer_payments"
    ALTER COLUMN "amount" TYPE DECIMAL(18,4);

ALTER TABLE "payment_allocations"
    ALTER COLUMN "amount" TYPE DECIMAL(18,4);

-- Pedidos (SalesOrder)
ALTER TABLE "sales_orders"
    ADD COLUMN "currency" CHAR(3),
    ADD COLUMN "exchange_rate" DECIMAL(18,8),
    ADD COLUMN "base_currency" CHAR(3),
    ADD COLUMN "base_exchange_rate" DECIMAL(18,8),
    ADD COLUMN "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "sales_orders" o
SET "currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = o."tenant_id"), 'USD'),
    "base_currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = o."tenant_id"), 'USD');

ALTER TABLE "sales_orders" ALTER COLUMN "currency" SET NOT NULL, ALTER COLUMN "base_currency" SET NOT NULL;

-- Despachos (Dispatch)
ALTER TABLE "dispatches"
    ADD COLUMN "currency" CHAR(3),
    ADD COLUMN "exchange_rate" DECIMAL(18,8),
    ADD COLUMN "base_currency" CHAR(3),
    ADD COLUMN "base_exchange_rate" DECIMAL(18,8),
    ADD COLUMN "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "dispatches" d
SET "currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = d."tenant_id"), 'USD'),
    "base_currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = d."tenant_id"), 'USD');

ALTER TABLE "dispatches" ALTER COLUMN "currency" SET NOT NULL, ALTER COLUMN "base_currency" SET NOT NULL;

-- Facturas (Invoice)
ALTER TABLE "invoices"
    ADD COLUMN "currency" CHAR(3),
    ADD COLUMN "exchange_rate" DECIMAL(18,8),
    ADD COLUMN "base_currency" CHAR(3),
    ADD COLUMN "base_exchange_rate" DECIMAL(18,8),
    ADD COLUMN "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "subtotal_ves" DECIMAL(18,4),
    ADD COLUMN "tax_ves" DECIMAL(18,4),
    ADD COLUMN "total_ves" DECIMAL(18,4);

UPDATE "invoices" i
SET "currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = i."tenant_id"), 'USD'),
    "base_currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = i."tenant_id"), 'USD');

ALTER TABLE "invoices" ALTER COLUMN "currency" SET NOT NULL, ALTER COLUMN "base_currency" SET NOT NULL;

-- Cobros (CustomerPayment)
ALTER TABLE "customer_payments"
    ADD COLUMN "currency" CHAR(3),
    ADD COLUMN "exchange_rate" DECIMAL(18,8),
    ADD COLUMN "base_currency" CHAR(3),
    ADD COLUMN "base_exchange_rate" DECIMAL(18,8),
    ADD COLUMN "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "amount_ves" DECIMAL(18,4);

UPDATE "customer_payments" p
SET "currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = p."tenant_id"), 'USD'),
    "base_currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = p."tenant_id"), 'USD');

ALTER TABLE "customer_payments" ALTER COLUMN "currency" SET NOT NULL, ALTER COLUMN "base_currency" SET NOT NULL;

-- Aplicaciones (PaymentAllocation)
ALTER TABLE "payment_allocations"
    ADD COLUMN "exchange_difference" DECIMAL(18,4) NOT NULL DEFAULT 0;
