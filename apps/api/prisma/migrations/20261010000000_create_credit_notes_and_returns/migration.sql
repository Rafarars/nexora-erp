-- CreateEnum
CREATE TYPE "return_condition" AS ENUM ('resalable', 'damaged', 'scrap');

-- CreateEnum
CREATE TYPE "sales_return_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "credit_note_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "credit_note_reason" AS ENUM ('return', 'subsequent_discount', 'price_correction', 'damaged_goods', 'cancellation', 'other');

-- CreateEnum
CREATE TYPE "purchase_return_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- AlterEnum
ALTER TYPE "payment_method" ADD VALUE 'credit_note';

-- AlterTable
ALTER TABLE "customer_payments" ADD COLUMN     "credit_source_id" UUID;

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "restores_movement_id" UUID;

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "customer_id" UUID NOT NULL,
    "dispatch_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "return_date" DATE NOT NULL,
    "condition" "return_condition" NOT NULL,
    "reason" VARCHAR(100),
    "notes" VARCHAR(500),
    "status" "sales_return_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "base_currency" CHAR(3) NOT NULL,
    "base_exchange_rate" DECIMAL(18,8),
    "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sales_return_id" UUID NOT NULL,
    "dispatch_line_id" UUID,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "item_sku" VARCHAR(60) NOT NULL,
    "item_name" VARCHAR(200) NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "restores_movement_id" UUID,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_id" UUID,
    "sales_return_id" UUID,
    "issue_payment_id" UUID,
    "issue_date" DATE NOT NULL,
    "reason" "credit_note_reason" NOT NULL,
    "reason_detail" VARCHAR(500),
    "notes" VARCHAR(500),
    "status" "credit_note_status" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "subtotal_ves" DECIMAL(18,4),
    "tax_ves" DECIMAL(18,4),
    "total_ves" DECIMAL(18,4),
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "base_currency" CHAR(3) NOT NULL,
    "base_exchange_rate" DECIMAL(18,8),
    "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_note_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID,
    "item_sku" VARCHAR(60),
    "item_name" VARCHAR(200),
    "concept" VARCHAR(200),
    "unit_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "customer_credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "return_date" DATE NOT NULL,
    "reason" VARCHAR(100),
    "notes" VARCHAR(500),
    "status" "purchase_return_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "base_currency" CHAR(3) NOT NULL,
    "base_exchange_rate" DECIMAL(18,8),
    "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_return_id" UUID NOT NULL,
    "receipt_line_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "item_sku" VARCHAR(60) NOT NULL,
    "item_name" VARCHAR(200) NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "restores_movement_id" UUID NOT NULL,

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_returns_tenant_id_customer_id_idx" ON "sales_returns"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "sales_returns_tenant_id_dispatch_id_idx" ON "sales_returns"("tenant_id", "dispatch_id");

-- CreateIndex
CREATE INDEX "sales_returns_tenant_id_status_idx" ON "sales_returns"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_tenant_id_id_key" ON "sales_returns"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_tenant_id_code_key" ON "sales_returns"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "sales_return_lines_tenant_id_dispatch_line_id_idx" ON "sales_return_lines"("tenant_id", "dispatch_line_id");

-- CreateIndex
CREATE INDEX "sales_return_lines_tenant_id_restores_movement_id_idx" ON "sales_return_lines"("tenant_id", "restores_movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_return_lines_sales_return_id_line_number_key" ON "sales_return_lines"("sales_return_id", "line_number");

-- CreateIndex
CREATE INDEX "customer_credit_notes_tenant_id_customer_id_idx" ON "customer_credit_notes"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_credit_notes_tenant_id_invoice_id_idx" ON "customer_credit_notes"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "customer_credit_notes_tenant_id_sales_return_id_idx" ON "customer_credit_notes"("tenant_id", "sales_return_id");

-- CreateIndex
CREATE INDEX "customer_credit_notes_tenant_id_status_idx" ON "customer_credit_notes"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_notes_tenant_id_id_key" ON "customer_credit_notes"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_notes_tenant_id_code_key" ON "customer_credit_notes"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_note_lines_credit_note_id_line_number_key" ON "customer_credit_note_lines"("credit_note_id", "line_number");

-- CreateIndex
CREATE INDEX "purchase_returns_tenant_id_supplier_id_idx" ON "purchase_returns"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_returns_tenant_id_receipt_id_idx" ON "purchase_returns"("tenant_id", "receipt_id");

-- CreateIndex
CREATE INDEX "purchase_returns_tenant_id_status_idx" ON "purchase_returns"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_tenant_id_id_key" ON "purchase_returns"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_tenant_id_code_key" ON "purchase_returns"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_return_lines_tenant_id_receipt_line_id_idx" ON "purchase_return_lines"("tenant_id", "receipt_line_id");

-- CreateIndex
CREATE INDEX "purchase_return_lines_tenant_id_restores_movement_id_idx" ON "purchase_return_lines"("tenant_id", "restores_movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_return_lines_purchase_return_id_line_number_key" ON "purchase_return_lines"("purchase_return_id", "line_number");

-- CreateIndex
CREATE INDEX "customer_payments_tenant_id_credit_source_id_idx" ON "customer_payments"("tenant_id", "credit_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_lines_tenant_id_id_key" ON "dispatch_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_tenant_id_id_key" ON "goods_receipt_lines"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "inventory_movements_restores_movement_id_idx" ON "inventory_movements"("restores_movement_id");


-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_restores_movement_id_fkey" FOREIGN KEY ("restores_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_tenant_id_credit_source_id_fkey" FOREIGN KEY ("tenant_id", "credit_source_id") REFERENCES "customer_credit_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_dispatch_id_fkey" FOREIGN KEY ("tenant_id", "dispatch_id") REFERENCES "dispatches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_sales_return_id_fkey" FOREIGN KEY ("tenant_id", "sales_return_id") REFERENCES "sales_returns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_dispatch_line_id_fkey" FOREIGN KEY ("tenant_id", "dispatch_line_id") REFERENCES "dispatch_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_restores_movement_id_fkey" FOREIGN KEY ("restores_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_tenant_id_sales_return_id_fkey" FOREIGN KEY ("tenant_id", "sales_return_id") REFERENCES "sales_returns"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_tenant_id_issue_payment_id_fkey" FOREIGN KEY ("tenant_id", "issue_payment_id") REFERENCES "customer_payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_tenant_id_credit_note_id_fkey" FOREIGN KEY ("tenant_id", "credit_note_id") REFERENCES "customer_credit_notes"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenant_id_receipt_id_fkey" FOREIGN KEY ("tenant_id", "receipt_id") REFERENCES "goods_receipts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenant_id_warehouse_id_fkey" FOREIGN KEY ("tenant_id", "warehouse_id") REFERENCES "warehouses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_tenant_id_purchase_return_id_fkey" FOREIGN KEY ("tenant_id", "purchase_return_id") REFERENCES "purchase_returns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_tenant_id_receipt_line_id_fkey" FOREIGN KEY ("tenant_id", "receipt_line_id") REFERENCES "goods_receipt_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_restores_movement_id_fkey" FOREIGN KEY ("restores_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones CHECK para devoluciones y notas de credito (solo validaciones dentro de la fila)
ALTER TABLE "sales_returns"
  ADD CONSTRAINT "sales_returns_exchange_rate_positive" CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0),
  ADD CONSTRAINT "sales_returns_base_exchange_rate_positive" CHECK ("base_exchange_rate" IS NULL OR "base_exchange_rate" > 0);

ALTER TABLE "sales_return_lines"
  ADD CONSTRAINT "sales_return_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0),
  ADD CONSTRAINT "sales_return_lines_unit_cost_not_negative" CHECK ("unit_cost" >= 0),
  ADD CONSTRAINT "sales_return_lines_line_number_positive" CHECK ("line_number" > 0);

ALTER TABLE "customer_credit_notes"
  ADD CONSTRAINT "customer_credit_notes_amounts_not_negative" CHECK ("subtotal" >= 0 AND "tax" >= 0 AND "total" > 0),
  ADD CONSTRAINT "customer_credit_notes_exchange_rate_positive" CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0),
  ADD CONSTRAINT "customer_credit_notes_base_exchange_rate_positive" CHECK ("base_exchange_rate" IS NULL OR "base_exchange_rate" > 0);

ALTER TABLE "customer_credit_note_lines"
  ADD CONSTRAINT "customer_credit_note_lines_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "customer_credit_note_lines_unit_price_not_negative" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "customer_credit_note_lines_subtotal_not_negative" CHECK ("subtotal" >= 0 AND "tax" >= 0),
  ADD CONSTRAINT "customer_credit_note_lines_tax_rate_range" CHECK ("tax_rate" BETWEEN 0 AND 100),
  ADD CONSTRAINT "customer_credit_note_lines_line_number_positive" CHECK ("line_number" > 0);

ALTER TABLE "purchase_returns"
  ADD CONSTRAINT "purchase_returns_exchange_rate_positive" CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0),
  ADD CONSTRAINT "purchase_returns_base_exchange_rate_positive" CHECK ("base_exchange_rate" IS NULL OR "base_exchange_rate" > 0);

ALTER TABLE "purchase_return_lines"
  ADD CONSTRAINT "purchase_return_lines_quantity_positive" CHECK ("quantity" > 0 AND "base_quantity" > 0),
  ADD CONSTRAINT "purchase_return_lines_unit_cost_not_negative" CHECK ("unit_cost" >= 0),
  ADD CONSTRAINT "purchase_return_lines_line_number_positive" CHECK ("line_number" > 0);

