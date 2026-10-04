import { describe, expect, it } from "vitest";
import { computeTotals, pickRate, splitBySupplier, type Line, type Rate } from "@/lib/pricing";
import { taxIncluded } from "@/lib/money";

const rates: Rate[] = [
  { minGrams: 0, maxGrams: 1000, priceCents: 350, etaDaysMin: 1, etaDaysMax: 3 },
  { minGrams: 1000, maxGrams: 5000, priceCents: 550, etaDaysMin: 1, etaDaysMax: 3 },
];
const line = (o: Partial<Line> = {}): Line => ({
  variantId: "v1", productId: "p1", supplierId: "s1", qty: 1,
  unitPrice: 1000, unitCost: 600, weightGrams: 400, ...o,
});

describe("tarifa de envío por tramo de peso", () => {
  it("elige el tramo correcto", () => {
    expect(pickRate(rates, 1000)?.priceCents).toBe(350);
    expect(pickRate(rates, 1001)?.priceCents).toBe(550);
  });
  it("usa el último tramo si el peso lo supera", () => {
    expect(pickRate(rates, 99999)?.priceCents).toBe(550);
  });
  it("sin tarifas devuelve null", () => {
    expect(pickRate([], 100)).toBeNull();
  });
});

describe("totales", () => {
  it("cobra un envío por proveedor (sub-pedido)", () => {
    const lines = [line({ supplierId: "a" }), line({ variantId: "v2", supplierId: "b" })];
    const t = computeTotals({ lines, rates, freeShippingOverCents: 0, ivaPercent: 15 });
    expect(t.subtotalCents).toBe(2000);
    expect(t.shippingBySupplier).toEqual({ a: 350, b: 350 });
    expect(t.shippingCents).toBe(700);
    expect(t.totalCents).toBe(2700);
  });
  it("suma el peso de las líneas del mismo proveedor", () => {
    const lines = [line({ qty: 2 }), line({ variantId: "v2", qty: 1 })]; // 1200 g
    const t = computeTotals({ lines, rates, freeShippingOverCents: 0, ivaPercent: 15 });
    expect(t.shippingBySupplier.s1).toBe(550);
  });
  it("envío gratis al superar el umbral", () => {
    const t = computeTotals({ lines: [line({ qty: 5 })], rates, freeShippingOverCents: 5000, ivaPercent: 15 });
    expect(t.freeShipping).toBe(true);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(5000);
  });
  it("el IVA es la parte contenida en el total", () => {
    expect(taxIncluded(11500, 15)).toBe(1500);
    expect(taxIncluded(1000, 0)).toBe(0);
  });
  it("agrupa líneas por proveedor", () => {
    const m = splitBySupplier([line({ supplierId: "a" }), line({ supplierId: "b" }), line({ supplierId: "a" })]);
    expect(m.get("a")).toHaveLength(2);
    expect(m.get("b")).toHaveLength(1);
  });
});
