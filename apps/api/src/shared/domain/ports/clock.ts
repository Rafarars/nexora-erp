export const CLOCK = Symbol('Clock');

// Permite congelar el tiempo en las pruebas: "una factura vencida hace 31 dias"
// deja de depender de que dia se ejecuten.
export interface Clock {
  now(): Date;
}
