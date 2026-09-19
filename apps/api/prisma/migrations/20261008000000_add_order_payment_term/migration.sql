-- El plazo de pago es una condicion pactada, como el impuesto de la linea: si el proveedor lo
-- cambia, la orden tiene que seguir diciendo lo que se acordo.
ALTER TABLE "purchase_orders" ADD COLUMN "payment_term_days" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_payment_term_days_range" CHECK ("payment_term_days" BETWEEN 0 AND 365);

-- Las ordenes que ya existen se quedan con el plazo que su proveedor tiene hoy, que es lo unico
-- que se sabe de ellas: no hay registro de cual regia cuando se emitieron.
UPDATE "purchase_orders" o
SET "payment_term_days" = s."payment_term_days"
FROM "suppliers" s
WHERE s."tenant_id" = o."tenant_id" AND s."id" = o."supplier_id";
