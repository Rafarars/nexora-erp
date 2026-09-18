-- Listas de precio de venta. La lista solo nombra el conjunto y dice en que moneda esta; los
-- precios cuelgan del articulo. Una sola lista por defecto por empresa, como la bodega.
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "currency" CHAR(3) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_lists_tenant_id_id_key" ON "price_lists"("tenant_id", "id");
CREATE UNIQUE INDEX "price_lists_tenant_id_code_key" ON "price_lists"("tenant_id", "code");
CREATE UNIQUE INDEX "price_lists_tenant_id_name_key" ON "price_lists"("tenant_id", "name");
CREATE INDEX "price_lists_tenant_id_is_default_idx" ON "price_lists"("tenant_id", "is_default");

ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una empresa no puede tener dos listas por defecto: la resolucion del precio elige una sola.
CREATE UNIQUE INDEX "price_lists_one_default_per_tenant" ON "price_lists"("tenant_id") WHERE "is_default";

-- Un solo precio por articulo y lista, sin vigencia: el historico vive en los documentos emitidos.
-- El precio esta en la unidad base del articulo.
CREATE TABLE "item_prices" (
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_prices_pkey" PRIMARY KEY ("tenant_id","item_id","price_list_id")
);

CREATE INDEX "item_prices_tenant_id_price_list_id_idx" ON "item_prices"("tenant_id", "price_list_id");

ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_tenant_id_price_list_id_fkey" FOREIGN KEY ("tenant_id", "price_list_id") REFERENCES "price_lists"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un precio negativo no existe; cero es regalar, que se decide a mano en la linea.
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_price_positive" CHECK ("price" >= 0);

-- Por debajo de este precio no se vende. En la moneda de la empresa: las listas pueden estar en
-- varias, asi que el precio de la linea se convierte antes de comparar.
ALTER TABLE "items" ADD COLUMN "min_price" DECIMAL(18,6);
ALTER TABLE "items" ADD CONSTRAINT "items_min_price_positive" CHECK ("min_price" IS NULL OR "min_price" >= 0);

-- La lista con la que se le cotiza al cliente; sin ella manda la lista por defecto de la empresa.
ALTER TABLE "customers" ADD COLUMN "price_list_id" UUID;
CREATE INDEX "customers_tenant_id_price_list_id_idx" ON "customers"("tenant_id", "price_list_id");
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_price_list_id_fkey" FOREIGN KEY ("tenant_id", "price_list_id") REFERENCES "price_lists"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La lista con la que se cotizo el pedido, que puede no ser la del cliente.
ALTER TABLE "sales_orders" ADD COLUMN "price_list_id" UUID;
CREATE INDEX "sales_orders_tenant_id_price_list_id_idx" ON "sales_orders"("tenant_id", "price_list_id");
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_price_list_id_fkey" FOREIGN KEY ("tenant_id", "price_list_id") REFERENCES "price_lists"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo que sugirio la lista, junto a lo que se cobro: la diferencia es el descuento, y que no sean
-- iguales significa que la persona pacto ese precio a mano.
ALTER TABLE "sales_order_lines" ADD COLUMN "list_price" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_list_price_positive" CHECK ("list_price" >= 0);
