import { describe, expect, it, vi } from "vitest";

// unstable_cache solo existe dentro de Next; en pruebas se ejecuta la función directamente.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { getFacets, listProducts, normalizeQuery, suggest } from "@/modules/catalog";

describe("catálogo (usa la base de datos de ejemplo; ejecuta npm run db:seed antes)", () => {
  it("normaliza la búsqueda", () => {
    expect(normalizeQuery("  CAMISÁ%%  Azúl ")).toBe("camisa azul");
  });

  it("lista productos publicados y pagina", async () => {
    const r = await listProducts({ page: 1 });
    expect(r.total).toBeGreaterThan(100);
    expect(r.items).toHaveLength(24);
    const p2 = await listProducts({ page: 2 });
    expect(p2.items[0].id).not.toBe(r.items[0].id);
  });

  it("filtra por categoría con todos sus descendientes", async () => {
    const r = await listProducts({ categoryPath: "moda-mujer" });
    expect(r.total).toBeGreaterThan(0);
    const all = await listProducts({});
    expect(r.total).toBeLessThan(all.total);
  });

  it("busca ignorando acentos y tolera errores de escritura", async () => {
    expect((await listProducts({ q: "vestidos" })).total).toBeGreaterThan(0);
    expect((await listProducts({ q: "vestidoz" })).total).toBeGreaterThan(0);
    expect((await listProducts({ q: "ÑAWI" })).total).toBeGreaterThan(0);
    expect((await listProducts({ q: "zzzzqqqq" })).total).toBe(0);
  });

  it("ordena por precio", async () => {
    const asc = await listProducts({ sort: "precio_asc" });
    const prices = asc.items.map((i) => i.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("filtra por talla y por precio", async () => {
    const r = await listProducts({ categoryPath: "calzado", sizes: ["40"], maxPrice: 8000 });
    for (const i of r.items) expect(i.priceCents).toBeLessThanOrEqual(8000);
  });

  it("ofrece filtros disponibles y sugerencias", async () => {
    const f = await getFacets({ categoryPath: "calzado" });
    expect(f.sizes).toContain("40");
    const s = await suggest("blus");
    expect(s.products.length + s.categories.length).toBeGreaterThan(0);
  });
});
