import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export const PAGE_SIZE = 24;

export type ProductCard = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  compareAtCents: number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  totalStock: number;
  leadDaysMin: number;
  leadDaysMax: number;
  image: string | null;
  brand: string | null;
};

export type SortKey = "relevancia" | "vendidos" | "novedades" | "precio_asc" | "precio_desc" | "valoracion";
export const SORT_LABEL: Record<SortKey, string> = {
  relevancia: "Más relevantes",
  vendidos: "Más vendidos",
  novedades: "Novedades",
  precio_asc: "Precio: menor a mayor",
  precio_desc: "Precio: mayor a menor",
  valoracion: "Mejor valorados",
};

export type ListParams = {
  q?: string;
  categoryPath?: string;
  minPrice?: number; // centavos
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  brands?: string[]; // ids
  minRating?: number;
  maxLeadDays?: number;
  sort?: SortKey;
  page?: number;
};

/** Texto de búsqueda: minúsculas, sin acentos, sin comodines de LIKE. */
export function normalizeQuery(q: string): string {
  return q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

const TITLE = Prisma.sql`f_unaccent(lower(p."title"))`;

function baseWhere(p: ListParams, qn: string): Prisma.Sql[] {
  const w: Prisma.Sql[] = [Prisma.sql`p."status" = 'PUBLISHED'`];
  if (p.categoryPath) {
    w.push(Prisma.sql`p."categoryId" IN (SELECT "id" FROM "Category" WHERE "path" = ${p.categoryPath} OR "path" LIKE ${p.categoryPath + "/%"})`);
  }
  if (qn) {
    // Coincidencia exacta de subcadena o similitud por trigramas (tolera errores de escritura).
    w.push(Prisma.sql`(${TITLE} LIKE ${"%" + qn + "%"} OR ${qn} <% ${TITLE})`);
  }
  return w;
}

function filterWhere(p: ListParams): Prisma.Sql[] {
  const w: Prisma.Sql[] = [];
  if (p.minPrice != null) w.push(Prisma.sql`p."priceCents" >= ${p.minPrice}`);
  if (p.maxPrice != null) w.push(Prisma.sql`p."priceCents" <= ${p.maxPrice}`);
  if (p.brands?.length) w.push(Prisma.sql`p."brandId" IN (${Prisma.join(p.brands)})`);
  if (p.minRating) w.push(Prisma.sql`p."ratingAvg" >= ${p.minRating}`);
  if (p.maxLeadDays) w.push(Prisma.sql`p."leadDaysMax" <= ${p.maxLeadDays}`);
  if (p.sizes?.length) {
    w.push(Prisma.sql`EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId" = p."id" AND v."active" AND v."options"->>'talla' IN (${Prisma.join(p.sizes)}))`);
  }
  if (p.colors?.length) {
    w.push(Prisma.sql`EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId" = p."id" AND v."active" AND v."options"->>'color' IN (${Prisma.join(p.colors)}))`);
  }
  return w;
}

function orderBy(sort: SortKey, qn: string): Prisma.Sql {
  switch (sort) {
    case "precio_asc": return Prisma.sql`p."priceCents" ASC, p."id"`;
    case "precio_desc": return Prisma.sql`p."priceCents" DESC, p."id"`;
    case "novedades": return Prisma.sql`p."createdAt" DESC, p."id"`;
    case "valoracion": return Prisma.sql`p."ratingAvg" DESC, p."ratingCount" DESC, p."id"`;
    case "vendidos": return Prisma.sql`p."soldCount" DESC, p."id"`;
    default:
      return qn
        ? Prisma.sql`word_similarity(${qn}, ${TITLE}) DESC, p."soldCount" DESC, p."id"`
        : Prisma.sql`p."soldCount" DESC, p."id"`;
  }
}

const CARD_COLUMNS = Prisma.sql`p."id", p."slug", p."title", p."priceCents", p."compareAtCents", p."ratingAvg", p."ratingCount",
  p."soldCount", p."totalStock", p."leadDaysMin", p."leadDaysMax",
  (SELECT i."url" FROM "ProductImage" i WHERE i."productId" = p."id" ORDER BY i."position" LIMIT 1) AS "image",
  (SELECT b."name" FROM "Brand" b WHERE b."id" = p."brandId") AS "brand"`;

export async function listProducts(params: ListParams): Promise<{ items: ProductCard[]; total: number; page: number; pages: number }> {
  const qn = params.q ? normalizeQuery(params.q) : "";
  const page = Math.min(Math.max(params.page ?? 1, 1), 500);
  const where = Prisma.join([...baseWhere(params, qn), ...filterWhere(params)], " AND ");
  const sort = params.sort ?? "relevancia";

  const [items, total] = await prisma.$transaction(async (tx) => {
    // Umbral de similitud: 0,45 tolera 1-2 letras equivocadas sin traer ruido.
    await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.45', true)`;
    const items = await tx.$queryRaw<ProductCard[]>`
      SELECT ${CARD_COLUMNS} FROM "Product" p WHERE ${where}
      ORDER BY ${orderBy(sort, qn)} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
    const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Product" p WHERE ${where}`;
    return [items, Number(n)] as const;
  });
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type Facets = { sizes: string[]; colors: string[]; brands: { id: string; name: string }[] };

/** Opciones de filtro disponibles dentro de la categoría o búsqueda actual. */
export async function getFacets(params: Pick<ListParams, "q" | "categoryPath">): Promise<Facets> {
  const qn = params.q ? normalizeQuery(params.q) : "";
  const where = Prisma.join(baseWhere(params, qn), " AND ");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.45', true)`;
    const opt = (key: string) => tx.$queryRaw<{ v: string }[]>`
      SELECT DISTINCT v."options"->>${key} AS v FROM "Variant" v JOIN "Product" p ON p."id" = v."productId"
      WHERE ${where} AND v."active" AND v."options" ? ${key} ORDER BY 1 LIMIT 40`;
    const [sizes, colors, brands] = await Promise.all([
      opt("talla"),
      opt("color"),
      tx.$queryRaw<{ id: string; name: string }[]>`
        SELECT DISTINCT b."id", b."name" FROM "Brand" b JOIN "Product" p ON p."brandId" = b."id"
        WHERE ${where} ORDER BY b."name" LIMIT 40`,
    ]);
    return { sizes: sizes.map((s) => s.v), colors: colors.map((c) => c.v), brands };
  });
}

export type CategoryNode = { id: string; name: string; path: string; level: number; children: CategoryNode[] };

export const getCategoryTree = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    const all = await prisma.category.findMany({ where: { isVisible: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });
    const nodes = new Map<string, CategoryNode>(all.map((c) => [c.id, { id: c.id, name: c.name, path: c.path, level: c.level, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const c of all) {
      const n = nodes.get(c.id)!;
      const parent = c.parentId ? nodes.get(c.parentId) : null;
      if (parent) parent.children.push(n);
      else if (!c.parentId) roots.push(n);
    }
    return roots;
  },
  ["category-tree"],
  { revalidate: 300, tags: ["categories"] },
);

export async function getCategoryByPath(path: string) {
  const cat = await prisma.category.findUnique({ where: { path }, include: { children: { where: { isVisible: true }, orderBy: [{ position: "asc" }, { name: "asc" }] } } });
  if (!cat || !cat.isVisible) return null;
  const parts = path.split("/");
  const crumbs = await prisma.category.findMany({
    where: { path: { in: parts.map((_, i) => parts.slice(0, i + 1).join("/")) } },
    select: { name: true, path: true, level: true },
    orderBy: { level: "asc" },
  });
  return { cat, crumbs };
}

export async function getProductBySlug(slug: string) {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      supplier: { select: { origin: true, country: true } },
      images: { orderBy: { position: "asc" } },
      variants: { where: { active: true }, orderBy: { priceCents: "asc" } },
      category: true,
    },
  });
  if (!p || p.status !== "PUBLISHED") return null;
  const parts = p.category.path.split("/");
  const chain = await prisma.category.findMany({
    where: { path: { in: parts.map((_, i) => parts.slice(0, i + 1).join("/")) } },
    include: { sizeGuide: true },
    orderBy: { level: "asc" },
  });
  const sizeGuide = [...chain].reverse().find((c) => c.sizeGuide)?.sizeGuide ?? null;
  return { product: p, crumbs: chain.map((c) => ({ name: c.name, path: c.path })), sizeGuide };
}

export async function getRelated(productId: string, categoryId: string, limit = 8): Promise<ProductCard[]> {
  return prisma.$queryRaw<ProductCard[]>`
    SELECT ${CARD_COLUMNS} FROM "Product" p
    WHERE p."status" = 'PUBLISHED' AND p."categoryId" = ${categoryId} AND p."id" <> ${productId}
    ORDER BY p."soldCount" DESC LIMIT ${limit}`;
}

export async function suggest(q: string): Promise<{ products: { title: string; slug: string }[]; categories: { name: string; path: string }[] }> {
  const qn = normalizeQuery(q);
  if (qn.length < 2) return { products: [], categories: [] };
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.45', true)`;
    const products = await tx.$queryRaw<{ title: string; slug: string }[]>`
      SELECT p."title", p."slug" FROM "Product" p
      WHERE p."status" = 'PUBLISHED' AND (${TITLE} LIKE ${"%" + qn + "%"} OR ${qn} <% ${TITLE})
      ORDER BY (${TITLE} LIKE ${qn + "%"}) DESC, word_similarity(${qn}, ${TITLE}) DESC, p."soldCount" DESC LIMIT 6`;
    const categories = await tx.$queryRaw<{ name: string; path: string }[]>`
      SELECT c."name", c."path" FROM "Category" c
      WHERE c."isVisible" AND f_unaccent(lower(c."name")) LIKE ${"%" + qn + "%"} ORDER BY c."level", c."name" LIMIT 3`;
    return { products, categories };
  });
}

export const getHomeSections = unstable_cache(
  async () => {
    const section = (where: Prisma.Sql, order: Prisma.Sql) =>
      prisma.$queryRaw<ProductCard[]>`SELECT ${CARD_COLUMNS} FROM "Product" p WHERE p."status" = 'PUBLISHED' AND p."totalStock" > 0 AND ${where} ORDER BY ${order} LIMIT 10`;
    const [deals, bestSellers, newest, recommended] = await Promise.all([
      section(Prisma.sql`p."compareAtCents" > p."priceCents"`, Prisma.sql`(p."compareAtCents" - p."priceCents")::float / p."compareAtCents" DESC, p."id"`),
      section(Prisma.sql`true`, Prisma.sql`p."soldCount" DESC, p."id"`),
      section(Prisma.sql`true`, Prisma.sql`p."createdAt" DESC, p."id"`),
      section(Prisma.sql`p."isRecommended"`, Prisma.sql`p."ratingAvg" DESC, p."id"`),
    ]);
    return { deals, bestSellers, newest, recommended };
  },
  ["home-sections"],
  { revalidate: 300, tags: ["products"] },
);
