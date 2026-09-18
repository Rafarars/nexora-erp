-- El codigo que trae impreso el producto, y si el articulo se compra y se vende: un insumo que no
-- se vende no deberia aparecer en un pedido.
ALTER TABLE "items" ADD COLUMN "barcode" VARCHAR(60),
ADD COLUMN "is_purchasable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "is_sellable" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "items_tenant_id_barcode_key" ON "items"("tenant_id", "barcode");
