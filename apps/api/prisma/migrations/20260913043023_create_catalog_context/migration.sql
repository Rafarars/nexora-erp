-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('inventoried', 'service');

-- CreateTable
CREATE TABLE "code_sequences" (
    "tenant_id" UUID NOT NULL,
    "prefix" VARCHAR(3) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("tenant_id","prefix")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "abbreviation" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(500),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "item_type" NOT NULL,
    "category_id" UUID,
    "tax_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_units" (
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "conversion_factor" DECIMAL(18,4) NOT NULL,
    "is_base" BOOLEAN NOT NULL,

    CONSTRAINT "item_units_pkey" PRIMARY KEY ("item_id","unit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_id_key" ON "categories"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_code_key" ON "categories"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_units_tenant_id_id_key" ON "measurement_units"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_units_tenant_id_code_key" ON "measurement_units"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_units_tenant_id_name_key" ON "measurement_units"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_units_tenant_id_abbreviation_key" ON "measurement_units"("tenant_id", "abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "taxes_tenant_id_id_key" ON "taxes"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "taxes_tenant_id_code_key" ON "taxes"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "taxes_tenant_id_name_key" ON "taxes"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "warehouses_tenant_id_is_default_idx" ON "warehouses"("tenant_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenant_id_code_key" ON "warehouses"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenant_id_name_key" ON "warehouses"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "items_tenant_id_category_id_idx" ON "items"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "items_tenant_id_tax_id_idx" ON "items"("tenant_id", "tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_tenant_id_id_key" ON "items"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "items_tenant_id_code_key" ON "items"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "items_tenant_id_sku_key" ON "items"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "item_units_tenant_id_unit_id_idx" ON "item_units"("tenant_id", "unit_id");

-- AddForeignKey
ALTER TABLE "code_sequences" ADD CONSTRAINT "code_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_units" ADD CONSTRAINT "measurement_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_category_id_fkey" FOREIGN KEY ("tenant_id", "category_id") REFERENCES "categories"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_tax_id_fkey" FOREIGN KEY ("tenant_id", "tax_id") REFERENCES "taxes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "measurement_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en el esquema y que la base debe hacer cumplir aunque
-- alguien escriba con SQL directo.
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_rate_range" CHECK ("rate" >= 0 AND "rate" <= 100);
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_factor_positive" CHECK ("conversion_factor" > 0);
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_base_factor_is_one" CHECK (NOT "is_base" OR "conversion_factor" = 1);
ALTER TABLE "code_sequences" ADD CONSTRAINT "code_sequences_last_value_positive" CHECK ("last_value" >= 0);
