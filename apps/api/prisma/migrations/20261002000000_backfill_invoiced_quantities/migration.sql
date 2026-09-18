-- Corrige el relleno de las dos migraciones anteriores para las facturas que ya existian.
--
-- 1) `order_line_id` se relleno cruzando articulo y unidad, y con dos lineas del mismo articulo y
--    la misma unidad en un pedido, Postgres elegia una cualquiera. El enlace exacto lo da el
--    despacho: la linea n de la factura es la linea n de su despacho, y `dispatch_lines` ya sabe
--    de que linea del pedido sale.
UPDATE "invoice_lines" SET "order_line_id" = "d"."order_line_id"
FROM "invoices" "i"
JOIN "dispatch_lines" "d" ON "d"."dispatch_id" = "i"."dispatch_id"
WHERE "i"."id" = "invoice_lines"."invoice_id"
  AND "d"."line_number" = "invoice_lines"."line_number";

-- 2) `invoiced_quantity` nacio en cero aunque la linea ya estuviera facturada, asi que anular una
--    factura anterior restaba de cero y reventaba. Se recalcula desde las facturas emitidas.
UPDATE "sales_order_lines" SET "invoiced_quantity" = COALESCE("facturado"."total", 0)
FROM (
    SELECT "l"."order_line_id", SUM("l"."quantity") AS "total"
    FROM "invoice_lines" "l"
    JOIN "invoices" "i" ON "i"."id" = "l"."invoice_id"
    WHERE "i"."status" = 'issued' AND "l"."order_line_id" IS NOT NULL
    GROUP BY "l"."order_line_id"
) AS "facturado"
WHERE "facturado"."order_line_id" = "sales_order_lines"."id";

-- La linea de factura apunta a una linea de pedido que existe: sin esta clave, editar un borrador
-- ya facturado dejaba facturas apuntando a lineas borradas.
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_order_line_id_fkey"
  FOREIGN KEY ("tenant_id", "order_line_id") REFERENCES "sales_order_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
