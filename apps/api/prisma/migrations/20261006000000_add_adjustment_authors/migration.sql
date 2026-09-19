-- Un ajuste mueve existencia sin una operacion comercial detras: es el hueco natural de un
-- inventario, y hasta ahora no quedaba constancia de quien lo hizo.
ALTER TABLE "adjustments"
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "confirmed_by" UUID,
  ADD COLUMN "cancelled_by" UUID;

-- Nulables a proposito: los ajustes que ya existen no dicen quien los hizo y no se puede
-- inventar. La pantalla lo muestra como desconocido.
ALTER TABLE "adjustments"
  ADD CONSTRAINT "adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "adjustments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "adjustments_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE RESTRICT;
