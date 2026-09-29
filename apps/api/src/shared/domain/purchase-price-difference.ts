export interface PriceDifferenceLineInput {
  quantity: number;
  invoiceUnitPrice: number;
  invoiceRate: number;
  receiptUnitCost: number;
  receiptRate: number;
}

export interface PurchasePriceDifferenceCalculation {
  priceDifference: number;      // En moneda base de la empresa con las tasas de la entrada
  exchangeDifference: number;   // En moneda base por variacion de tipo de cambio
  lineDifferences: {
    unitDifferenceDoc: number;
    totalDifferenceDoc: number;
    priceDifferenceBase: number;
    exchangeDifferenceBase: number;
  }[];
}

function round4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

// Devuelve el factor de conversion de la moneda del documento a la moneda base de la empresa.
export function effectiveRateToBase(
  currency: string,
  baseCurrency: string,
  exchangeRate: number | null,
  baseExchangeRate: number | null,
): number {
  if (currency === baseCurrency || !exchangeRate || !baseExchangeRate) {
    return 1;
  }
  return exchangeRate / baseExchangeRate;
}

// Calcula la diferencia de precio y la diferencia en cambio para compras y cuentas por pagar (H9 §3.3 y §5.3)
export function calculatePurchasePriceDifference(
  lines: PriceDifferenceLineInput[],
): PurchasePriceDifferenceCalculation {
  let totalPriceDiffBase = 0;
  let totalExchangeDiffBase = 0;

  const lineDifferences = lines.map((line) => {
    const unitDiffDoc = round4(line.invoiceUnitPrice - line.receiptUnitCost);
    const totalDiffDoc = round4(unitDiffDoc * line.quantity);
    const priceDiffBase = round4(totalDiffDoc * line.receiptRate);
    const exchangeDiffBase = round4(line.quantity * line.invoiceUnitPrice * (line.invoiceRate - line.receiptRate));

    totalPriceDiffBase += priceDiffBase;
    totalExchangeDiffBase += exchangeDiffBase;

    return {
      unitDifferenceDoc: unitDiffDoc,
      totalDifferenceDoc: totalDiffDoc,
      priceDifferenceBase: priceDiffBase,
      exchangeDifferenceBase: exchangeDiffBase,
    };
  });

  return {
    priceDifference: round4(totalPriceDiffBase),
    exchangeDifference: round4(totalExchangeDiffBase),
    lineDifferences,
  };
}
