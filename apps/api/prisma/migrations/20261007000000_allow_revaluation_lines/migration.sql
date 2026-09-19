-- La linea de una revaluacion no mueve cantidad: lleva el costo nuevo y nada mas. La guarda
-- sigue existiendo, pero ahora dice lo que de verdad se quiere: o la linea mueve una cantidad
-- positiva, o no mueve ninguna y entonces trae el costo con que se revalora.
ALTER TABLE "adjustment_lines" DROP CONSTRAINT "adjustment_lines_quantity_positive";

ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_quantity_positive" CHECK (
  ("quantity" > 0 AND "base_quantity" > 0)
  OR ("quantity" = 0 AND "base_quantity" = 0 AND "unit_cost" IS NOT NULL)
);
