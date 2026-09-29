-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoice_lines_tenant_id_id_key" ON "purchase_invoice_lines"("tenant_id", "id");

-- AlterTable
ALTER TABLE "supplier_credit_note_lines" ADD COLUMN "invoice_line_id" UUID;

-- CreateIndex
CREATE INDEX "supplier_credit_note_lines_tenant_id_invoice_line_id_idx" ON "supplier_credit_note_lines"("tenant_id", "invoice_line_id");

-- AddForeignKey
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_tenant_id_invoice_line_id_fkey" FOREIGN KEY ("tenant_id", "invoice_line_id") REFERENCES "purchase_invoice_lines"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
