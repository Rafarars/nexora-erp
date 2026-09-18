-- De que linea del pedido sale cada linea de factura. Anular una factura devuelve lo facturado a
-- esa linea; sin el enlace, un servicio ya facturado no se podria volver a cobrar aunque su factura
-- se anulara.
ALTER TABLE "invoice_lines" ADD COLUMN "order_line_id" UUID;

-- Las facturas que ya existen nacieron de un despacho: la linea de pedido es la de la linea de
-- despacho con el mismo articulo y unidad dentro de esa factura.
UPDATE "invoice_lines" SET "order_line_id" = "l"."id"
FROM "sales_order_lines" "l"
JOIN "invoices" "i" ON "i"."order_id" = "l"."order_id"
WHERE "i"."id" = "invoice_lines"."invoice_id"
  AND "l"."item_id" = "invoice_lines"."item_id"
  AND "l"."unit_id" = "invoice_lines"."unit_id";

CREATE INDEX "invoice_lines_tenant_id_order_line_id_idx" ON "invoice_lines"("tenant_id", "order_line_id");
