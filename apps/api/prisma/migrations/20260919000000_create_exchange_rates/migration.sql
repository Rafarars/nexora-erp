-- Las tasas de cambio de cada empresa: bolivares por 1 unidad de la moneda, por fecha y tipo. Los
-- parametros ganan la serie de tasas con que la empresa valora sus documentos.

-- CreateEnum
CREATE TYPE "ExchangeRateType" AS ENUM ('legal', 'manual');

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "rate_type" "ExchangeRateType" NOT NULL DEFAULT 'legal';

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "rate_date" DATE NOT NULL,
    "type" "ExchangeRateType" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rates_tenant_id_rate_date_idx" ON "exchange_rates"("tenant_id", "rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_tenant_id_id_key" ON "exchange_rates"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_tenant_id_currency_type_rate_date_key" ON "exchange_rates"("tenant_id", "currency", "type", "rate_date");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una tasa vale mas que cero, y el bolivar no lleva tasa: vale siempre 1.
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_rate_positive" CHECK ("rate" > 0);
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_foreign_currency" CHECK ("currency" <> 'VES');
