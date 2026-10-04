/** Cálculo de totales, envío y división por proveedor. Funciones puras (sin base de datos). */
import { taxIncluded } from "./money";

export type Line = {
  variantId: string;
  productId: string;
  supplierId: string;
  qty: number;
  unitPrice: number; // centavos, IVA incluido
  unitCost: number;
  weightGrams: number; // por unidad
};

export type Rate = {
  minGrams: number;
  maxGrams: number; // el tramo cubre (minGrams, maxGrams]
  priceCents: number;
  etaDaysMin: number;
  etaDaysMax: number;
};

export function splitBySupplier<T extends { supplierId: string }>(lines: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const l of lines) {
    const list = out.get(l.supplierId);
    if (list) list.push(l);
    else out.set(l.supplierId, [l]);
  }
  return out;
}

export function lineWeight(lines: Line[]): number {
  return lines.reduce((g, l) => g + l.weightGrams * l.qty, 0);
}

/** Tarifa del tramo de peso. Si el peso supera el último tramo se usa el último. */
export function pickRate(rates: Rate[], grams: number): Rate | null {
  if (rates.length === 0) return null;
  const sorted = [...rates].sort((a, b) => a.maxGrams - b.maxGrams);
  return sorted.find((r) => grams > r.minGrams && grams <= r.maxGrams) ?? sorted[sorted.length - 1];
}

export type Totals = {
  subtotalCents: number;
  shippingBySupplier: Record<string, number>;
  etaBySupplier: Record<string, { min: number; max: number }>;
  shippingCents: number;
  totalCents: number;
  taxCents: number;
  freeShipping: boolean;
};

export function computeTotals(opts: {
  lines: Line[];
  rates: Rate[]; // tarifas de la provincia de entrega
  freeShippingOverCents: number; // 0 = desactivado
  ivaPercent: number;
}): Totals {
  const { lines, rates, freeShippingOverCents, ivaPercent } = opts;
  const subtotalCents = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const freeShipping = freeShippingOverCents > 0 && subtotalCents >= freeShippingOverCents;

  const shippingBySupplier: Record<string, number> = {};
  const etaBySupplier: Record<string, { min: number; max: number }> = {};
  for (const [supplierId, supplierLines] of splitBySupplier(lines)) {
    const rate = pickRate(rates, lineWeight(supplierLines));
    shippingBySupplier[supplierId] = freeShipping ? 0 : (rate?.priceCents ?? 0);
    etaBySupplier[supplierId] = { min: rate?.etaDaysMin ?? 0, max: rate?.etaDaysMax ?? 0 };
  }
  const shippingCents = Object.values(shippingBySupplier).reduce((a, b) => a + b, 0);
  const totalCents = subtotalCents + shippingCents;
  return {
    subtotalCents,
    shippingBySupplier,
    etaBySupplier,
    shippingCents,
    totalCents,
    taxCents: taxIncluded(totalCents, ivaPercent),
    freeShipping,
  };
}
