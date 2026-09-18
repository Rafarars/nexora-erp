-- Un servicio se compra y se vende, pero no sale ni entra de una bodega. Que la linea mueva
-- existencia se copia al escribirla, como el SKU y el nombre: el documento no cambia de sentido
-- porque el maestro cambie despues.
ALTER TABLE "purchase_order_lines" ADD COLUMN "moves_stock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sales_order_lines" ADD COLUMN "moves_stock" BOOLEAN NOT NULL DEFAULT true;

-- Lo facturado de una linea de pedido. Lo despachado y lo facturado no miden lo mismo: un servicio
-- se factura igual que un tornillo, pero no se despacha nunca.
ALTER TABLE "sales_order_lines" ADD COLUMN "invoiced_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_invoiced_quantity_positive" CHECK ("invoiced_quantity" >= 0);

-- La factura puede nacer de un pedido sin despacho, cuando todo lo que vende son servicios. El
-- pedido ya estaba en la fila: lo que se afloja es el despacho.
ALTER TABLE "invoices" ALTER COLUMN "dispatch_id" DROP NOT NULL;

