-- El contexto de empresa: el catalogo global de monedas, los datos que la empresa pone en sus
-- documentos y sus parametros. Una fila por empresa, escrita la primera vez que se guarda.

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "tenant_id" UUID NOT NULL,
    "legal_name" VARCHAR(150) NOT NULL,
    "trade_name" VARCHAR(150),
    "fiscal_id" VARCHAR(30),
    "address" VARCHAR(300),
    "phone" VARCHAR(40),
    "email" VARCHAR(150),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "tenant_id" UUID NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "secondary_currency" CHAR(3),
    "time_zone" VARCHAR(64) NOT NULL,
    "amount_decimals" INTEGER NOT NULL,
    "price_decimals" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_secondary_currency_fkey" FOREIGN KEY ("secondary_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los decimales tienen el techo de la columna que los guarda: importes con cuatro, precios con seis.
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_amount_decimals_range" CHECK ("amount_decimals" BETWEEN 0 AND 4);
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_price_decimals_range" CHECK ("price_decimals" BETWEEN 0 AND 6);

-- Las monedas con que nace el sistema. Son datos de produccion, no de demostracion.
INSERT INTO "currencies" ("code", "name", "symbol", "decimals", "sort_order") VALUES
    ('USD', 'Dólar estadounidense', '$', 2, 1),
    ('EUR', 'Euro', '€', 2, 2),
    ('VES', 'Bolívar', 'Bs.', 2, 3);
