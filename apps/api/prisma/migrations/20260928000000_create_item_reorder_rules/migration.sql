-- Cuanto se quiere tener de un articulo en cada bodega: por debajo del minimo hay que reponer.
-- Va por articulo y bodega, como en Odoo, ERPNext y Business Central, no plano en el articulo.
CREATE TABLE "item_reorder_rules" (
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "min_quantity" DECIMAL(18,4) NOT NULL,
    "max_quantity" DECIMAL(18,4),
    "reorder_quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "item_reorder_rules_pkey" PRIMARY KEY ("tenant_id","item_id","warehouse_id")
);

CREATE INDEX "item_reorder_rules_tenant_id_warehouse_id_idx" ON "item_reorder_rules"("tenant_id", "warehouse_id");

ALTER TABLE "item_reorder_rules" ADD CONSTRAINT "item_reorder_rules_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_reorder_rules" ADD CONSTRAINT "item_reorder_rules_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cantidades sin signo, y un maximo que no puede ser menor que el minimo.
ALTER TABLE "item_reorder_rules" ADD CONSTRAINT "item_reorder_rules_quantities_positive" CHECK ("min_quantity" >= 0 AND "reorder_quantity" >= 0 AND ("max_quantity" IS NULL OR "max_quantity" >= "min_quantity"));
