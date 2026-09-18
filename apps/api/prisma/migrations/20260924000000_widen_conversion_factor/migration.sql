-- Ocho decimales en el factor de conversion: con cuatro, una base "docena" daba 0,0833 por pieza y
-- doce piezas sumaban 0,9996 docenas.
ALTER TABLE "item_units" ALTER COLUMN "conversion_factor" SET DATA TYPE DECIMAL(18,8);
