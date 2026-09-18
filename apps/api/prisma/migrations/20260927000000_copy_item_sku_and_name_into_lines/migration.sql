-- Cada linea guarda el SKU y el nombre del articulo con que se escribio: renombrar un articulo no
-- cambia lo que dice un documento ya emitido. Lo existente se rellena con lo que dice el maestro hoy.

ALTER TABLE "adjustment_lines" ADD COLUMN "item_sku" VARCHAR(60), ADD COLUMN "item_name" VARCHAR(200);

UPDATE "adjustment_lines" AS l SET "item_sku" = i."sku", "item_name" = i."name" FROM "items" AS i WHERE i."id" = l."item_id";

ALTER TABLE "adjustment_lines" ALTER COLUMN "item_sku" SET NOT NULL, ALTER COLUMN "item_name" SET NOT NULL;

ALTER TABLE "purchase_order_lines" ADD COLUMN "item_sku" VARCHAR(60), ADD COLUMN "item_name" VARCHAR(200);

UPDATE "purchase_order_lines" AS l SET "item_sku" = i."sku", "item_name" = i."name" FROM "items" AS i WHERE i."id" = l."item_id";

ALTER TABLE "purchase_order_lines" ALTER COLUMN "item_sku" SET NOT NULL, ALTER COLUMN "item_name" SET NOT NULL;

ALTER TABLE "goods_receipt_lines" ADD COLUMN "item_sku" VARCHAR(60), ADD COLUMN "item_name" VARCHAR(200);

UPDATE "goods_receipt_lines" AS l SET "item_sku" = i."sku", "item_name" = i."name" FROM "items" AS i WHERE i."id" = l."item_id";

ALTER TABLE "goods_receipt_lines" ALTER COLUMN "item_sku" SET NOT NULL, ALTER COLUMN "item_name" SET NOT NULL;

ALTER TABLE "sales_order_lines" ADD COLUMN "item_sku" VARCHAR(60), ADD COLUMN "item_name" VARCHAR(200);

UPDATE "sales_order_lines" AS l SET "item_sku" = i."sku", "item_name" = i."name" FROM "items" AS i WHERE i."id" = l."item_id";

ALTER TABLE "sales_order_lines" ALTER COLUMN "item_sku" SET NOT NULL, ALTER COLUMN "item_name" SET NOT NULL;

ALTER TABLE "dispatch_lines" ADD COLUMN "item_sku" VARCHAR(60), ADD COLUMN "item_name" VARCHAR(200);

UPDATE "dispatch_lines" AS l SET "item_sku" = i."sku", "item_name" = i."name" FROM "items" AS i WHERE i."id" = l."item_id";

ALTER TABLE "dispatch_lines" ALTER COLUMN "item_sku" SET NOT NULL, ALTER COLUMN "item_name" SET NOT NULL;

ALTER TABLE "invoice_lines" ADD COLUMN "item_sku" VARCHAR(60), ADD COLUMN "item_name" VARCHAR(200);

UPDATE "invoice_lines" AS l SET "item_sku" = i."sku", "item_name" = i."name" FROM "items" AS i WHERE i."id" = l."item_id";

ALTER TABLE "invoice_lines" ALTER COLUMN "item_sku" SET NOT NULL, ALTER COLUMN "item_name" SET NOT NULL;
