-- CreateEnum
CREATE TYPE "adjustment_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "stock_direction" AS ENUM ('in', 'out');

-- CreateTable
CREATE TABLE "adjustments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "adjustment_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "status" "adjustment_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "adjustment_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "direction" "stock_direction" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6),

    CONSTRAINT "adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "direction" "stock_direction" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "balance_quantity" DECIMAL(18,4) NOT NULL,
    "balance_average_cost" DECIMAL(18,6) NOT NULL,
    "origin_type" VARCHAR(20) NOT NULL,
    "origin_id" UUID NOT NULL,
    "origin_line_id" UUID,
    "reversal_of_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_stocks" (
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_stocks_pkey" PRIMARY KEY ("tenant_id","item_id","warehouse_id")
);

-- CreateIndex
CREATE INDEX "adjustments_tenant_id_status_idx" ON "adjustments"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "adjustments_tenant_id_id_key" ON "adjustments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "adjustments_tenant_id_code_key" ON "adjustments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "adjustment_lines_tenant_id_item_id_idx" ON "adjustment_lines"("tenant_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "adjustment_lines_adjustment_id_line_number_key" ON "adjustment_lines"("adjustment_id", "line_number");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_origin_type_origin_id_idx" ON "inventory_movements"("tenant_id", "origin_type", "origin_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_tenant_id_item_id_warehouse_id_sequence_key" ON "inventory_movements"("tenant_id", "item_id", "warehouse_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_reversal_of_id_key" ON "inventory_movements"("reversal_of_id");

-- CreateIndex
CREATE INDEX "item_stocks_tenant_id_warehouse_id_idx" ON "item_stocks"("tenant_id", "warehouse_id");

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_tenant_id_adjustment_id_fkey" FOREIGN KEY ("tenant_id", "adjustment_id") REFERENCES "adjustments"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa y que la base hace cumplir aunque alguien escriba SQL a
-- mano. La mas importante: la existencia nunca queda negativa.
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_quantity_not_negative" CHECK ("quantity" >= 0);
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_average_cost_not_negative" CHECK ("average_cost" >= 0);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_balance_not_negative" CHECK ("balance_quantity" >= 0);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_unit_cost_not_negative" CHECK ("unit_cost" >= 0);
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0);
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_unit_cost_not_negative" CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0);
