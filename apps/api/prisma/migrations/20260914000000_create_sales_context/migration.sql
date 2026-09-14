-- CreateEnum
CREATE TYPE "sales_order_status" AS ENUM ('draft', 'confirmed', 'partially_dispatched', 'dispatched', 'cancelled');

-- CreateEnum
CREATE TYPE "dispatch_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('issued', 'cancelled');

-- CreateTable
CREATE TABLE "customers" (
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

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "order_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "status" "sales_order_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "dispatched_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "order_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "dispatch_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "status" "dispatch_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "order_line_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "dispatch_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "status" "invoice_status" NOT NULL DEFAULT 'issued',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_id_key" ON "customers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_code_key" ON "customers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_name_key" ON "customers"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "sales_orders_tenant_id_status_idx" ON "sales_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sales_orders_tenant_id_customer_id_idx" ON "sales_orders"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_tenant_id_id_key" ON "sales_orders"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_tenant_id_code_key" ON "sales_orders"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "sales_order_lines_tenant_id_item_id_idx" ON "sales_order_lines"("tenant_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_tenant_id_id_key" ON "sales_order_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_order_id_line_number_key" ON "sales_order_lines"("order_id", "line_number");

-- CreateIndex
CREATE INDEX "dispatches_tenant_id_order_id_idx" ON "dispatches"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "dispatches_tenant_id_status_idx" ON "dispatches"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_tenant_id_id_key" ON "dispatches"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_tenant_id_code_key" ON "dispatches"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "dispatch_lines_tenant_id_order_line_id_idx" ON "dispatch_lines"("tenant_id", "order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_lines_dispatch_id_line_number_key" ON "dispatch_lines"("dispatch_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_lines_dispatch_id_order_line_id_key" ON "dispatch_lines"("dispatch_id", "order_line_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_dispatch_id_idx" ON "invoices"("tenant_id", "dispatch_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_customer_id_idx" ON "invoices"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_id_key" ON "invoices"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_code_key" ON "invoices"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_line_number_key" ON "invoice_lines"("invoice_id", "line_number");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "sales_orders"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "sales_orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_tenant_id_dispatch_id_fkey" FOREIGN KEY ("tenant_id", "dispatch_id") REFERENCES "dispatches"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_tenant_id_order_line_id_fkey" FOREIGN KEY ("tenant_id", "order_line_id") REFERENCES "sales_order_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_dispatch_id_fkey" FOREIGN KEY ("tenant_id", "dispatch_id") REFERENCES "dispatches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "sales_orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas que Prisma no expresa. La mas importante: nunca sale mas de lo vendido.
ALTER TABLE "customers" ADD CONSTRAINT "customers_payment_term_days_range" CHECK ("payment_term_days" BETWEEN 0 AND 365);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_unit_price_not_negative" CHECK ("unit_price" >= 0);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tax_rate_range" CHECK ("tax_rate" BETWEEN 0 AND 100);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_dispatched_within_ordered" CHECK ("dispatched_quantity" >= 0 AND "dispatched_quantity" <= "quantity");
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0);
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_due_not_before_issue" CHECK ("due_date" >= "issue_date");

-- Un despacho se factura una sola vez: dos emisiones simultaneas no pueden pasar las dos.
CREATE UNIQUE INDEX "invoices_one_issued_per_dispatch" ON "invoices" ("tenant_id", "dispatch_id") WHERE "status" = 'issued';
