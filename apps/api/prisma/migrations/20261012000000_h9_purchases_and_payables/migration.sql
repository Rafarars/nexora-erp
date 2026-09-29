-- CreateEnum
CREATE TYPE "revaluation_kind" AS ENUM ('cost', 'amount');

-- CreateEnum
CREATE TYPE "purchase_invoice_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- DropForeignKey
ALTER TABLE "adjustments" DROP CONSTRAINT "adjustments_cancelled_by_fkey";

-- DropForeignKey
ALTER TABLE "adjustments" DROP CONSTRAINT "adjustments_confirmed_by_fkey";

-- DropForeignKey
ALTER TABLE "adjustments" DROP CONSTRAINT "adjustments_created_by_fkey";

-- AlterTable
ALTER TABLE "adjustment_lines" ADD COLUMN     "amount" DECIMAL(18,4),
ADD COLUMN     "revaluation_kind" "revaluation_kind",
ADD COLUMN     "sold_part" DECIMAL(18,4),
ADD COLUMN     "source_movement_id" UUID,
ADD COLUMN     "stock_part" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "adjustments" ADD COLUMN     "origin_id" UUID,
ADD COLUMN     "origin_type" VARCHAR(30);

-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN     "invoiced_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_invoice_number" VARCHAR(60) NOT NULL,
    "supplier_invoice_series" VARCHAR(20),
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "status" "purchase_invoice_status" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "price_difference" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "exchange_difference" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "base_currency" CHAR(3) NOT NULL,
    "base_exchange_rate" DECIMAL(18,8),
    "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,
    "subtotal_ves" DECIMAL(18,4),
    "tax_ves" DECIMAL(18,4),
    "total_ves" DECIMAL(18,4),

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "receipt_line_id" UUID,
    "order_line_id" UUID,
    "item_id" UUID,
    "item_sku" VARCHAR(60),
    "item_name" VARCHAR(200) NOT NULL,
    "concept" VARCHAR(200),
    "unit_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" "payment_method" NOT NULL,
    "credit_source_id" UUID,
    "reference" VARCHAR(100),
    "notes" VARCHAR(500),
    "status" "payment_status" NOT NULL DEFAULT 'draft',
    "amount" DECIMAL(18,4) NOT NULL,
    "amount_ves" DECIMAL(18,4),
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "base_currency" CHAR(3) NOT NULL,
    "base_exchange_rate" DECIMAL(18,8),
    "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "exchange_difference" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "invoice_id" UUID,
    "purchase_return_id" UUID,
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
    "price_difference" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "exchange_difference" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "base_currency" CHAR(3) NOT NULL,
    "base_exchange_rate" DECIMAL(18,8),
    "manual_exchange_rate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_note_lines" (
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

    CONSTRAINT "supplier_credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_invoices_tenant_id_supplier_id_idx" ON "purchase_invoices"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_tenant_id_status_idx" ON "purchase_invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_id_key" ON "purchase_invoices"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_code_key" ON "purchase_invoices"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_tenant_id_receipt_line_id_idx" ON "purchase_invoice_lines"("tenant_id", "receipt_line_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_tenant_id_order_line_id_idx" ON "purchase_invoice_lines"("tenant_id", "order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoice_lines_invoice_id_line_number_key" ON "purchase_invoice_lines"("invoice_id", "line_number");

-- CreateIndex
CREATE INDEX "supplier_payments_tenant_id_supplier_id_idx" ON "supplier_payments"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payments_tenant_id_status_idx" ON "supplier_payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "supplier_payments_tenant_id_credit_source_id_idx" ON "supplier_payments"("tenant_id", "credit_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_tenant_id_id_key" ON "supplier_payments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_tenant_id_code_key" ON "supplier_payments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_tenant_id_invoice_id_idx" ON "supplier_payment_allocations"("tenant_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payment_allocations_tenant_id_id_key" ON "supplier_payment_allocations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payment_allocations_payment_id_invoice_id_key" ON "supplier_payment_allocations"("payment_id", "invoice_id");

-- CreateIndex
CREATE INDEX "supplier_credit_notes_tenant_id_supplier_id_idx" ON "supplier_credit_notes"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_credit_notes_tenant_id_invoice_id_idx" ON "supplier_credit_notes"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "supplier_credit_notes_tenant_id_purchase_return_id_idx" ON "supplier_credit_notes"("tenant_id", "purchase_return_id");

-- CreateIndex
CREATE INDEX "supplier_credit_notes_tenant_id_status_idx" ON "supplier_credit_notes"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_notes_tenant_id_id_key" ON "supplier_credit_notes"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_notes_tenant_id_code_key" ON "supplier_credit_notes"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_note_lines_credit_note_id_line_number_key" ON "supplier_credit_note_lines"("credit_note_id", "line_number");

-- CreateIndex
CREATE INDEX "adjustment_lines_tenant_id_source_movement_id_idx" ON "adjustment_lines"("tenant_id", "source_movement_id");

-- CreateIndex
CREATE INDEX "adjustments_tenant_id_origin_type_origin_id_idx" ON "adjustments"("tenant_id", "origin_type", "origin_id");

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_source_movement_id_fkey" FOREIGN KEY ("source_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_tenant_id_receipt_line_id_fkey" FOREIGN KEY ("tenant_id", "receipt_line_id") REFERENCES "goods_receipt_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_tenant_id_order_line_id_fkey" FOREIGN KEY ("tenant_id", "order_line_id") REFERENCES "purchase_order_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_tenant_id_credit_source_id_fkey" FOREIGN KEY ("tenant_id", "credit_source_id") REFERENCES "supplier_credit_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "supplier_payments"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_tenant_id_purchase_return_id_fkey" FOREIGN KEY ("tenant_id", "purchase_return_id") REFERENCES "purchase_returns"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_tenant_id_issue_payment_id_fkey" FOREIGN KEY ("tenant_id", "issue_payment_id") REFERENCES "supplier_payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_tenant_id_credit_note_id_fkey" FOREIGN KEY ("tenant_id", "credit_note_id") REFERENCES "supplier_credit_notes"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (Partial unique index for active supplier invoice number antifraud control - H9 §3.1)
CREATE UNIQUE INDEX "purchase_invoices_one_active_number_per_supplier"
  ON "purchase_invoices" ("tenant_id", "supplier_id", "supplier_invoice_number")
  WHERE "status" <> 'cancelled';

-- Update check constraint for adjustment lines to support revaluation by amount (H9 §4.1)
ALTER TABLE "adjustment_lines" DROP CONSTRAINT IF EXISTS "adjustment_lines_quantity_positive";
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_quantity_positive" CHECK (
  ("quantity" > 0 AND "base_quantity" > 0)
  OR ("quantity" = 0 AND "base_quantity" = 0 AND ("unit_cost" IS NOT NULL OR "amount" IS NOT NULL))
);

