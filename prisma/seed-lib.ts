/** Generador de productos FICTICIOS para demos y pruebas de carga. */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { DocKey } from "./data/categories";

export const makePrisma = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

export type Leaf = { id: string; topSlug: string; subName: string; docs: DocKey[] | null };
export type SupplierRef = { id: string; origin: "NACIONAL" | "INTERNACIONAL" };

const ADJ = ["clásico", "moderno", "premium", "económico", "versátil", "resistente", "práctico", "elegante", "compacto", "edición limitada", "ligero", "duradero"];
const MODELS = ["Kuntur", "Inti", "Quilla", "Sacha", "Puma", "Pacha", "Allpa", "Yaku", "Nina", "Wayra", "Ñawi", "Sumak", "Chakana", "Mashi"];
const COLORS = ["Negro", "Blanco", "Azul", "Rojo", "Verde", "Gris", "Beige", "Rosado", "Café", "Morado"];

const SIZES_ROPA_M = ["XS", "S", "M", "L", "XL"];
const SIZES_ROPA_H = ["S", "M", "L", "XL", "XXL"];
const SIZES_NINO = ["2", "4", "6", "8", "10", "12"];
const SIZES_BEBE = ["0-3 m", "3-6 m", "6-12 m", "12-18 m"];
const SIZES_CALZ = ["36", "37", "38", "39", "40", "41", "42"];
const SIZES_CALZ_INF = ["24", "26", "28", "30", "32"];

function sizesFor(leaf: Leaf): string[] | null {
  const sub = leaf.subName.toLowerCase();
  switch (leaf.topSlug) {
    case "moda-mujer": return sub.includes("tallas grandes") ? ["XL", "2XL", "3XL", "4XL"] : SIZES_ROPA_M;
    case "moda-hombre": return SIZES_ROPA_H;
    case "ninos-y-bebes":
      if (sub.includes("bebé")) return SIZES_BEBE;
      if (sub.includes("calzado")) return SIZES_CALZ_INF;
      if (sub.includes("niña") || sub.includes("niño")) return SIZES_NINO;
      return null;
    case "calzado": return SIZES_CALZ;
    default: return null;
  }
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: readonly T[]) => arr[rnd(0, arr.length - 1)];
const price90 = (cents: number) => Math.max(199, Math.round(cents / 100) * 100 - 10); // termina en ,90

export type Batch = {
  products: Record<string, unknown>[];
  variants: Record<string, unknown>[];
  images: Record<string, unknown>[];
  docs: Record<string, unknown>[];
};

export function genProducts(count: number, leaves: Leaf[], suppliers: SupplierRef[], brandIds: string[], tag: string): Batch {
  const out: Batch = { products: [], variants: [], images: [], docs: [] };
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const leaf = pick(leaves);
    const supplier = pick(suppliers);
    const id = randomUUID();
    const model = pick(MODELS);
    const title = `${leaf.subName.replace(/\s*\(.*\)$/, "")} ${pick(ADJ)} ${model} ${rnd(1, 999)}`;
    const intl = supplier.origin === "INTERNACIONAL";
    const cost = rnd(300, 6000);
    const basePrice = price90(Math.round(cost * (1.4 + Math.random() * 0.9)));
    const onSale = Math.random() < 0.3;
    const sizes = sizesFor(leaf);
    const colors = Math.random() < 0.6 ? [pick(COLORS), pick(COLORS)].filter((c, idx, a) => a.indexOf(c) === idx) : [];
    const original = Math.random() < 0.25;
    const rated = Math.random() < 0.7;

    out.products.push({
      id,
      supplierId: supplier.id,
      categoryId: leaf.id,
      brandId: original ? pick(brandIds) : null,
      brandDeclaration: original ? "ORIGINAL_AUTORIZADO" : "GENERICO_SIN_MARCA",
      declaredAt: new Date(now),
      title,
      slug: `${slugify(title)}-${tag}-${i.toString(36)}`,
      description: `${title}. Producto de demostración con datos ficticios para probar el catálogo. Material y acabados de buena calidad, ideal para el uso diario.`,
      status: "PUBLISHED",
      leadDaysMin: intl ? 12 : rnd(1, 3),
      leadDaysMax: intl ? rnd(18, 25) : rnd(3, 6),
      attributes: {},
      weightGrams: rnd(150, 3500),
      isRecommended: Math.random() < 0.12,
      ratingAvg: rated ? Math.round((3.5 + Math.random() * 1.5) * 10) / 10 : 0,
      ratingCount: rated ? rnd(1, 180) : 0,
      soldCount: rnd(0, 400),
      priceCents: basePrice,
      compareAtCents: onSale ? price90(Math.round(basePrice * (1.25 + Math.random() * 0.3))) : null,
      totalStock: 0,
      createdAt: new Date(now - rnd(0, 90) * 86_400_000),
    });

    // Variantes: talla × color (si aplica) o una sola.
    const combos: Record<string, string>[] = [];
    if (sizes) for (const s of sizes) for (const c of colors.length ? colors : [""]) combos.push(c ? { talla: s, color: c } : { talla: s });
    else if (colors.length) for (const c of colors) combos.push({ color: c });
    else combos.push({});
    let totalStock = 0;
    combos.slice(0, 12).forEach((options, vi) => {
      const stock = Math.random() < 0.08 ? 0 : rnd(1, 40);
      totalStock += stock;
      out.variants.push({
        id: randomUUID(),
        productId: id,
        sku: `${tag.toUpperCase()}-${i.toString(36).toUpperCase()}-${vi}`,
        options,
        costCents: cost,
        priceCents: basePrice,
        compareAtCents: onSale ? (out.products[out.products.length - 1].compareAtCents as number) : null,
        stock,
      });
    });
    (out.products[out.products.length - 1] as { totalStock: number }).totalStock = totalStock;

    for (let k = 0; k < 3; k++) out.images.push({ id: randomUUID(), productId: id, url: `/placeholder/${slugify(model)}-${(i * 3 + k) % 97}.svg`, alt: title, position: k });

    if (leaf.docs) {
      const roll = Math.random();
      // Mayoría vigentes; algunos por vencer para probar las alertas.
      const days = roll < 0.05 ? rnd(5, 40) : rnd(120, 700);
      out.docs.push({
        id: randomUUID(), productId: id, type: pick(leaf.docs), number: `DEMO-${rnd(100000, 999999)}`,
        issuer: "Entidad de ejemplo", issuedAt: new Date(now - 200 * 86_400_000), expiresAt: new Date(now + days * 86_400_000),
        fileUrl: "https://ejemplo.invalid/documento-demo.pdf", review: "APPROVED",
      });
    }
  }
  return out;
}

export async function insertBatch(prisma: PrismaClient, b: Batch) {
  await prisma.product.createMany({ data: b.products as never });
  await prisma.variant.createMany({ data: b.variants as never });
  await prisma.productImage.createMany({ data: b.images as never });
  if (b.docs.length) await prisma.complianceDoc.createMany({ data: b.docs as never });
}
