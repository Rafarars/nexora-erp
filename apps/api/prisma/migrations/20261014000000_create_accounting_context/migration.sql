-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "cogs_account_id" UUID,
ADD COLUMN     "inventory_account_id" UUID,
ADD COLUMN     "purchase_expense_account_id" UUID,
ADD COLUMN     "sales_revenue_account_id" UUID;

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "cash_account_id" UUID,
ADD COLUMN     "cogs_account_id" UUID,
ADD COLUMN     "exchange_difference_account_id" UUID,
ADD COLUMN     "inventory_account_id" UUID,
ADD COLUMN     "inventory_adjustment_account_id" UUID,
ADD COLUMN     "opening_equity_account_id" UUID,
ADD COLUMN     "payables_account_id" UUID,
ADD COLUMN     "pending_price_difference_account_id" UUID,
ADD COLUMN     "price_difference_account_id" UUID,
ADD COLUMN     "purchase_expense_account_id" UUID,
ADD COLUMN     "receivables_account_id" UUID,
ADD COLUMN     "sales_revenue_account_id" UUID,
ADD COLUMN     "tax_payable_account_id" UUID,
ADD COLUMN     "unapplied_credit_notes_account_id" UUID,
ADD COLUMN     "unapplied_supplier_credit_notes_account_id" UUID,
ADD COLUMN     "unbilled_goods_account_id" UUID;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "cogs_account_id" UUID,
ADD COLUMN     "inventory_account_id" UUID,
ADD COLUMN     "purchase_expense_account_id" UUID,
ADD COLUMN     "sales_revenue_account_id" UUID;

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "AccountType" NOT NULL,
    "accepts_entries" BOOLEAN NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "entry_date" DATE NOT NULL,
    "origin_type" VARCHAR(30) NOT NULL,
    "origin_id" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reversal_of_id" UUID,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(18,4) NOT NULL,
    "credit" DECIMAL(18,4) NOT NULL,
    "label" VARCHAR(200) NOT NULL,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_tenant_id_parent_id_idx" ON "accounts"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenant_id_id_key" ON "accounts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenant_id_code_key" ON "accounts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "journal_entries_tenant_id_origin_type_origin_id_idx" ON "journal_entries"("tenant_id", "origin_type", "origin_id");

-- CreateIndex
CREATE INDEX "journal_entries_tenant_id_entry_date_idx" ON "journal_entries"("tenant_id", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversal_of_id_key" ON "journal_entries"("reversal_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_tenant_id_id_key" ON "journal_entries"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_tenant_id_code_key" ON "journal_entries"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "journal_entry_lines_tenant_id_entry_id_idx" ON "journal_entry_lines"("tenant_id", "entry_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_tenant_id_account_id_idx" ON "journal_entry_lines"("tenant_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_lines_tenant_id_id_key" ON "journal_entry_lines"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints (ARCHITECTURE.md:247 and H10 §4.2)
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_debit_credit_exclusive"
  CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));

ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_debit_credit_positive"
  CHECK ("debit" >= 0 AND "credit" >= 0);
