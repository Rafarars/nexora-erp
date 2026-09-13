// Prisma devuelve las columnas decimal como objetos Decimal. Con cuatro o seis decimales y
// los rangos de este sistema, `toNumber` es exacto; el dominio los vuelve enteros.
export function toNumber(value: { toNumber(): number } | number | string): number {
  return typeof value === 'object' ? value.toNumber() : Number(value);
}
