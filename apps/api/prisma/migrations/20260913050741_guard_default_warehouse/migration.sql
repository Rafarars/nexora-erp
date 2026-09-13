-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenant_id_id_key" ON "warehouses"("tenant_id", "id");


-- Una sola bodega por defecto por empresa, aunque dos personas la elijan a la vez.
-- Prisma no expresa indices parciales en el esquema y no los ve como deriva: se
-- comprobo con `prisma migrate diff` antes de anadirlo.
CREATE UNIQUE INDEX "warehouses_one_default_per_tenant" ON "warehouses" ("tenant_id") WHERE "is_default";
