-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'transfer', 'card', 'check');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "credit_limit" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "customer_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "customer_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" "payment_method" NOT NULL,
    "reference" VARCHAR(100),
    "notes" VARCHAR(500),
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_payments_tenant_id_customer_id_idx" ON "customer_payments"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_payments_tenant_id_status_idx" ON "customer_payments"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_payments_tenant_id_id_key" ON "customer_payments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_payments_tenant_id_code_key" ON "customer_payments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_invoice_id_idx" ON "payment_allocations"("tenant_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_tenant_id_id_key" ON "payment_allocations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_invoice_id_key" ON "payment_allocations"("payment_id", "invoice_id");

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "customer_payments"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas que la base hace cumplir aunque falle la aplicacion.
ALTER TABLE "customers" ADD CONSTRAINT "customers_credit_limit_not_negative" CHECK ("credit_limit" IS NULL OR "credit_limit" >= 0);
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0);
