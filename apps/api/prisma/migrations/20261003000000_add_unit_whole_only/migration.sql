-- Media pieza no significa nada y media caja tampoco; medio kilo si. La unidad dice si admite
-- fracciones, y cada linea de documento la respeta. Por defecto se siguen admitiendo, que es lo
-- que hacian todas hasta ahora.
ALTER TABLE "measurement_units" ADD COLUMN "must_be_whole" BOOLEAN NOT NULL DEFAULT false;
