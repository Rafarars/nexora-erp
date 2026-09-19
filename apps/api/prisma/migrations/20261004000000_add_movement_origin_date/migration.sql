-- El kardex guardaba solo el instante de la publicacion. Un ajuste fechado en agosto y
-- confirmado en septiembre aparecia en septiembre: el documento decia una fecha y el kardex
-- otra. Se guarda tambien el dia que el documento declara.
ALTER TABLE "inventory_movements" ADD COLUMN "origin_date" DATE;

-- Los movimientos que ya existen toman la fecha de su documento.
UPDATE "inventory_movements" m
SET "origin_date" = a."adjustment_date"
FROM "adjustments" a
WHERE m."origin_type" = 'adjustment' AND m."origin_id" = a."id";

UPDATE "inventory_movements" m
SET "origin_date" = r."receipt_date"
FROM "goods_receipts" r
WHERE m."origin_type" = 'receipt' AND m."origin_id" = r."id";

UPDATE "inventory_movements" m
SET "origin_date" = d."dispatch_date"
FROM "dispatches" d
WHERE m."origin_type" = 'dispatch' AND m."origin_id" = d."id";

-- Red de seguridad: si algun movimiento quedara huerfano, su propia fecha de publicacion.
UPDATE "inventory_movements" SET "origin_date" = "occurred_at"::date WHERE "origin_date" IS NULL;

ALTER TABLE "inventory_movements" ALTER COLUMN "origin_date" SET NOT NULL;
