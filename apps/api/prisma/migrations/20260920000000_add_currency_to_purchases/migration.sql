-- Las ordenes y entradas de compra llevan su moneda y las dos tasas que congelan: bolivares por 1
-- unidad de su moneda y de la moneda de la empresa. Las anteriores quedan en la moneda de la empresa
-- y sin tasas, que es como se escribieron. Los parametros dicen si un documento admite una tasa
-- escrita a mano.

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN "allows_rate_override" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "purchase_orders"
    ADD COLUMN "currency" CHAR(3),
    ADD COLUMN "exchange_rate" DECIMAL(18,8),
    ADD COLUMN "base_currency" CHAR(3),
    ADD COLUMN "base_exchange_rate" DECIMAL(18,8),
    ADD COLUMN "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "purchase_orders" o
SET "currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = o."tenant_id"), 'USD'),
    "base_currency" = COALESCE((SELECT s."base_currency" FROM "company_settings" s WHERE s."tenant_id" = o."tenant_id"), 'USD');

ALTER TABLE "purchase_orders" ALTER COLUMN "currency" SET NOT NULL, ALTER COLUMN "base_currency" SET NOT NULL;

-- AlterTable
ALTER TABLE "goods_receipts"
    ADD COLUMN "currency" CHAR(3),
    ADD COLUMN "exchange_rate" DECIMAL(18,8),
    ADD COLUMN "base_currency" CHAR(3),
    ADD COLUMN "base_exchange_rate" DECIMAL(18,8),
    ADD COLUMN "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "goods_receipts" r
SET "currency" = o."currency", "base_currency" = o."base_currency"
FROM "purchase_orders" o
WHERE o."tenant_id" = r."tenant_id" AND o."id" = r."order_id";

ALTER TABLE "goods_receipts" ALTER COLUMN "currency" SET NOT NULL, ALTER COLUMN "base_currency" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las dos tasas van juntas (o ninguna, en lo anterior al multimoneda) y valen mas que cero.
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rates_together" CHECK (("exchange_rate" IS NULL) = ("base_exchange_rate" IS NULL));
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rates_positive" CHECK ("exchange_rate" > 0 AND "base_exchange_rate" > 0);
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_rates_together" CHECK (("exchange_rate" IS NULL) = ("base_exchange_rate" IS NULL));
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_rates_positive" CHECK ("exchange_rate" > 0 AND "base_exchange_rate" > 0);
