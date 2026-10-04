/** Prueba de carga: agrega N productos ficticios (por defecto 30 000). npm run db:seed:load -- 30000 */
import { genProducts, insertBatch, makePrisma, type Leaf } from "./seed-lib";

const prisma = makePrisma();

async function main() {
  const total = Number(process.argv[2] ?? 30000);
  const cats = await prisma.category.findMany({ where: { level: 2 }, include: { parent: true } });
  const leaves: Leaf[] = cats.map((c) => ({
    id: c.id, topSlug: c.parent!.slug, subName: c.name, docs: c.parent!.isRegulated ? (c.parent!.acceptedDocTypes as Leaf["docs"]) : null,
  }));
  const suppliers = (await prisma.supplier.findMany()).map((s) => ({ id: s.id, origin: s.origin }));
  const brandIds = (await prisma.brand.findMany()).map((b) => b.id);
  const tag = Date.now().toString(36);
  const chunk = 1000;
  for (let done = 0; done < total; done += chunk) {
    await insertBatch(prisma, genProducts(Math.min(chunk, total - done), leaves, suppliers, brandIds, `l${tag}${done / chunk}`));
    process.stdout.write(`\r${Math.min(done + chunk, total)} / ${total}`);
  }
  console.log("\nProductos en total:", await prisma.product.count());
}

main().finally(() => prisma.$disconnect());
