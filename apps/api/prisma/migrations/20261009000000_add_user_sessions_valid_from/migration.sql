-- Las sesiones emitidas antes de esta fecha dejan de valer. Las filas existentes la
-- reciben con la fecha del despliegue: las sesiones abiertas en ese momento caen, que es
-- el comportamiento seguro cuando se estrena la revocacion.
ALTER TABLE "users"
  ADD COLUMN "sessions_valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
