-- Arreglos de la moneda en ventas y cobranza. El despacho no lleva tasas: no tiene importes. Cada
-- aplicacion de un cobro guarda la tasa de la moneda de su factura el dia del cobro, y su
-- diferencial cambiario puede no existir (facturas anteriores a las tasas). El limite de credito
-- ya estaba declarado con cuatro decimales, pero la migracion anterior no lo cambio.

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "credit_limit" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "dispatches" DROP COLUMN "base_currency",
DROP COLUMN "base_exchange_rate",
DROP COLUMN "currency",
DROP COLUMN "exchange_rate",
DROP COLUMN "manual_exchange_rate";

-- AlterTable
ALTER TABLE "payment_allocations" ADD COLUMN "exchange_rate" DECIMAL(18,8),
ALTER COLUMN "exchange_difference" DROP NOT NULL,
ALTER COLUMN "exchange_difference" DROP DEFAULT;

UPDATE "payment_allocations" SET "exchange_difference" = NULL WHERE "exchange_rate" IS NULL;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las dos tasas van juntas (o ninguna, en lo anterior al multimoneda) y valen mas que cero.
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_rates_together" CHECK (("exchange_rate" IS NULL) = ("base_exchange_rate" IS NULL));
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_rates_positive" CHECK ("exchange_rate" > 0 AND "base_exchange_rate" > 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rates_together" CHECK (("exchange_rate" IS NULL) = ("base_exchange_rate" IS NULL));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rates_positive" CHECK ("exchange_rate" > 0 AND "base_exchange_rate" > 0);
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_rates_together" CHECK (("exchange_rate" IS NULL) = ("base_exchange_rate" IS NULL));
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_rates_positive" CHECK ("exchange_rate" > 0 AND "base_exchange_rate" > 0);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_rate_positive" CHECK ("exchange_rate" > 0);
