-- Un ajuste no decia por que se hacia: solo notas libres y opcionales. Sin motivo no hay forma
-- de saber cuanto se perdio por merma frente a cuanto se corrigio por conteo.
CREATE TYPE "AdjustmentType" AS ENUM (
  'physical_count', 'loss', 'damage', 'expiration', 'theft', 'correction', 'revaluation', 'other'
);

-- Los ajustes que ya existen no dicen su motivo, y no se puede adivinar: quedan como "otro".
ALTER TABLE "adjustments" ADD COLUMN "type" "AdjustmentType" NOT NULL DEFAULT 'other';
ALTER TABLE "adjustments" ALTER COLUMN "type" DROP DEFAULT;

-- El motivo es lo primero por lo que se filtra un listado de ajustes.
CREATE INDEX "adjustments_tenant_id_type_idx" ON "adjustments" ("tenant_id", "type");
