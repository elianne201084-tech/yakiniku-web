/** Todo el dinero se guarda en centavos de USD (enteros) para evitar errores de redondeo. */

const fmt = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export function formatUSD(cents: number): string {
  return fmt.format(cents / 100);
}

/** Convierte "12,50" o "12.5" a 1250. Devuelve null si no es un monto válido. */
export function parseUSDToCents(input: string): number | null {
  const n = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Los precios de venta incluyen IVA. Devuelve la parte de IVA contenida en `grossCents`.
 * `ratePercent` es la tarifa vigente (configurable; ver Settings).
 */
export function taxIncluded(grossCents: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0;
  return Math.round(grossCents - grossCents / (1 + ratePercent / 100));
}

export function discountPercent(priceCents: number, compareAtCents: number | null | undefined): number {
  if (!compareAtCents || compareAtCents <= priceCents) return 0;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}
