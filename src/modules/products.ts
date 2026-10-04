import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { checkPublishable, resolveRegulation, type DocTypeKey, type PublishInput } from "./compliance";

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Ancestros de una categoría (de la raíz a ella), a partir de su path "a/b/c". */
export async function categoryChain(categoryId: string) {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) return [];
  const parts = cat.path.split("/");
  const paths = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  const nodes = await prisma.category.findMany({ where: { path: { in: paths } } });
  return paths.map((p) => nodes.find((n) => n.path === p)!).filter(Boolean);
}

/** Recalcula precio mínimo, "antes" y stock total que se usan para listar rápido y filtrar. */
export async function syncProductDenorm(tx: Prisma.TransactionClient | typeof prisma, productId: string) {
  const variants = await tx.variant.findMany({ where: { productId, active: true } });
  const cheapest = variants.reduce<(typeof variants)[number] | null>(
    (m, v) => (m === null || v.priceCents < m.priceCents ? v : m),
    null,
  );
  await tx.product.update({
    where: { id: productId },
    data: {
      priceCents: cheapest?.priceCents ?? 0,
      compareAtCents: cheapest?.compareAtCents ?? null,
      totalStock: variants.reduce((s, v) => s + v.stock, 0),
    },
  });
}

export async function loadPublishInput(productId: string): Promise<PublishInput | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, images: { select: { id: true } }, variants: { where: { active: true } }, docs: true },
  });
  if (!p) return null;
  const chain = await categoryChain(p.categoryId);
  return {
    title: p.title,
    brandDeclaration: p.brandDeclaration,
    declaredAt: p.declaredAt,
    brandName: p.brand?.name ?? null,
    brandBlocked: p.brand?.blocked ?? false,
    hasImage: p.images.length > 0,
    activeVariants: p.variants.map((v) => ({ priceCents: v.priceCents, costCents: v.costCents })),
    docs: p.docs.map((d) => ({ type: d.type as DocTypeKey, expiresAt: d.expiresAt, review: d.review })),
    regulation: resolveRegulation(
      chain.map((c) => ({ isRegulated: c.isRegulated, acceptedDocTypes: c.acceptedDocTypes as DocTypeKey[] })),
    ),
  };
}

/** Publica un producto solo si cumple todas las reglas. Devuelve los motivos si no puede. */
export async function publishProduct(productId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const input = await loadPublishInput(productId);
  if (!input) return { ok: false, errors: ["Producto no encontrado."] };
  const errors = checkPublishable(input);
  if (errors.length) return { ok: false, errors };
  await syncProductDenorm(prisma, productId);
  await prisma.product.update({ where: { id: productId }, data: { status: "PUBLISHED" } });
  return { ok: true };
}

/**
 * Despublica los productos publicados que dejaron de cumplir (documento vencido, etc.).
 * Se ejecuta a diario desde /api/cron/compliance.
 */
export async function suspendNonCompliant(): Promise<{ checked: number; suspended: string[] }> {
  const published = await prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true } });
  const suspended: string[] = [];
  for (const p of published) {
    const input = await loadPublishInput(p.id);
    if (input && checkPublishable(input).length > 0) {
      await prisma.product.update({ where: { id: p.id }, data: { status: "SUSPENDED" } });
      await prisma.auditLog.create({
        data: { entity: "Product", entityId: p.id, action: "auto-suspend", diff: { reason: "incumple reglas de publicación" } },
      });
      suspended.push(p.title);
    }
  }
  return { checked: published.length, suspended };
}
