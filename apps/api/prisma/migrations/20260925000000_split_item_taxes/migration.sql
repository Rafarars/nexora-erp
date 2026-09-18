-- Un articulo puede comprarse exento y venderse con IVA: el impuesto de venta y el de compra se
-- separan. Lo que habia valia para los dos.
ALTER TABLE "items" ADD COLUMN "sales_tax_id" UUID,
ADD COLUMN "purchase_tax_id" UUID;

UPDATE "items" SET "sales_tax_id" = "tax_id", "purchase_tax_id" = "tax_id";

DROP INDEX "items_tenant_id_tax_id_idx";
ALTER TABLE "items" DROP CONSTRAINT "items_tenant_id_tax_id_fkey";
ALTER TABLE "items" DROP COLUMN "tax_id";

CREATE INDEX "items_tenant_id_sales_tax_id_idx" ON "items"("tenant_id", "sales_tax_id");
CREATE INDEX "items_tenant_id_purchase_tax_id_idx" ON "items"("tenant_id", "purchase_tax_id");

ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_sales_tax_id_fkey" FOREIGN KEY ("tenant_id", "sales_tax_id") REFERENCES "taxes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_purchase_tax_id_fkey" FOREIGN KEY ("tenant_id", "purchase_tax_id") REFERENCES "taxes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
