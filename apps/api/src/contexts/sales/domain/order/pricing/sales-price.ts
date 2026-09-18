import { roundedDivision } from '../../../../../shared/domain/amount.js';
import { UnitPrice } from '../../shared/money.js';

// Tasas y factores de conversion se guardan con ocho decimales.
const SCALE = 100_000_000n;

// Los precios se guardan en millonesimas: mas decimales que esos no caben en la columna, aunque la
// empresa admita hasta ocho en lo que escribe una persona.
const PRICE_DECIMALS_LIMIT = 6;

const scaled = (value: number): bigint => BigInt(Math.round(value * 100_000_000));

export interface PriceConversion {
  // Bolivares por 1 unidad de la moneda de la lista.
  listRate: number;
  // Bolivares por 1 unidad de la moneda del documento.
  documentRate: number;
}

// Lo que cuesta en el documento una unidad de venta, a partir del precio que la lista guarda en la
// unidad base:
//
//   precio de lista  ->  x factor de la unidad elegida  ->  convertido por el bolivar  ->  redondeado
//
// La conversion pasa por el bolivar, como el cobro de una factura en otra moneda. Si la lista ya
// esta en la moneda del documento no se convierte nada: multiplicar y dividir por la misma tasa
// solo aniadiria un redondeo.
export function priceForDocument(
  listPrice: UnitPrice,
  conversionFactor: number,
  decimals: number,
  conversion: PriceConversion | null,
): UnitPrice {
  const factor = scaled(conversionFactor);
  const perUnit = roundedDivision(listPrice.micros * factor, SCALE);
  const converted = conversion === null ? perUnit : roundedDivision(perUnit * scaled(conversion.listRate), scaled(conversion.documentRate));

  return UnitPrice.of(Number(roundToDecimals(converted, decimals)) / 1_000_000);
}

// Redondea un precio en millonesimas a los decimales de la empresa, sin salirse de lo que la
// columna guarda.
function roundToDecimals(micros: bigint, decimals: number): bigint {
  const step = 10n ** BigInt(PRICE_DECIMALS_LIMIT - Math.min(decimals, PRICE_DECIMALS_LIMIT));

  return roundedDivision(micros, step) * step;
}
