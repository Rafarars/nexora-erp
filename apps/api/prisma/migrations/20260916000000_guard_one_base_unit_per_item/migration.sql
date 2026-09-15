-- Una sola unidad base por articulo, tambien para quien escriba en la base sin pasar por el
-- dominio. Todo el stock se guarda en la base: dos bases harian ambiguo el kardex. Prisma no
-- expresa indices parciales en el esquema; igual que la bodega por defecto, vive aqui.
CREATE UNIQUE INDEX "item_units_one_base_per_item" ON "item_units" ("tenant_id", "item_id") WHERE "is_base";
