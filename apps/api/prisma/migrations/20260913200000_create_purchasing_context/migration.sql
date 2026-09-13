-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('draft', 'confirmed', 'partially_received', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "goods_receipt_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "fiscal_id" VARCHAR(30),
    "email" VARCHAR(150),
    "phone" VARCHAR(40),
    "address" VARCHAR(500),
    "payment_term_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "notes" VARCHAR(500),
    "status" "purchase_order_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "order_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "receipt_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "status" "goods_receipt_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "order_line_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_id_key" ON "suppliers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_name_key" ON "suppliers"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_status_idx" ON "purchase_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_supplier_id_idx" ON "purchase_orders"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_id_key" ON "purchase_orders"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_code_key" ON "purchase_orders"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_order_lines_tenant_id_item_id_idx" ON "purchase_order_lines"("tenant_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_tenant_id_id_key" ON "purchase_order_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_order_id_line_number_key" ON "purchase_order_lines"("order_id", "line_number");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_order_id_idx" ON "goods_receipts"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_status_idx" ON "goods_receipts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenant_id_id_key" ON "goods_receipts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenant_id_code_key" ON "goods_receipts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_tenant_id_order_line_id_idx" ON "goods_receipt_lines"("tenant_id", "order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_receipt_id_line_number_key" ON "goods_receipt_lines"("receipt_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_receipt_id_order_line_id_key" ON "goods_receipt_lines"("receipt_id", "order_line_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "purchase_orders"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "purchase_orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_receipt_id_fkey" FOREIGN KEY ("tenant_id", "receipt_id") REFERENCES "goods_receipts"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_order_line_id_fkey" FOREIGN KEY ("tenant_id", "order_line_id") REFERENCES "purchase_order_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas que Prisma no expresa. La mas importante: nunca se recibe mas de lo pedido.
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_payment_term_days_range" CHECK ("payment_term_days" BETWEEN 0 AND 365);
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0);
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_unit_cost_not_negative" CHECK ("unit_cost" >= 0);
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_rate_range" CHECK ("tax_rate" BETWEEN 0 AND 100);
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_received_within_ordered" CHECK ("received_quantity" >= 0 AND "received_quantity" <= "quantity");
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0);
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_unit_cost_not_negative" CHECK ("unit_cost" >= 0);
