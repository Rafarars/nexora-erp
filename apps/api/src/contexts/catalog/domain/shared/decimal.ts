// Las cantidades del catalogo se guardan con cuatro decimales. Un numero con mas se
// redondearia en silencio en la base; se rechaza antes para que nadie guarde lo que
// no escribio.
export function hasAtMostFourDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 10_000) - value * 10_000) < 1e-6;
}
