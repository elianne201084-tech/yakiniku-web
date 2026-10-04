/**
 * Datos de ejemplo FICTICIOS. Idempotente: se puede ejecutar varias veces.
 * Ejecuta:  npm run db:seed
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { CATEGORIES, PROVINCES, SIZE_GUIDES } from "./data/categories";
import { genProducts, insertBatch, makePrisma, slugify, type Leaf } from "./seed-lib";

const prisma = makePrisma();

const REGION_RATES: Record<string, { first: number; second: number; third: number; etaMin: number; etaMax: number }> = {
  // Tarifas de MUESTRA. Reemplázalas con las de tus empresas de courier.
  principal: { first: 350, second: 550, third: 950, etaMin: 1, etaMax: 3 },
  Sierra: { first: 450, second: 650, third: 1100, etaMin: 2, etaMax: 4 },
  Costa: { first: 450, second: 650, third: 1100, etaMin: 2, etaMax: 4 },
  Oriente: { first: 600, second: 850, third: 1400, etaMin: 4, etaMax: 7 },
  Insular: { first: 1800, second: 2600, third: 4200, etaMin: 7, etaMax: 12 },
};

async function main() {
  // Provincias y tarifas
  for (const p of PROVINCES) {
    await prisma.province.upsert({ where: { code: p.code }, create: p, update: { name: p.name, region: p.region } });
  }
  await prisma.shippingRate.deleteMany();
  for (const p of PROVINCES) {
    const r = ["17", "09", "01"].includes(p.code) ? REGION_RATES.principal : REGION_RATES[p.region];
    await prisma.shippingRate.createMany({
      data: [
        { provinceCode: p.code, minGrams: 0, maxGrams: 1000, priceCents: r.first, etaDaysMin: r.etaMin, etaDaysMax: r.etaMax },
        { provinceCode: p.code, minGrams: 1000, maxGrams: 5000, priceCents: r.second, etaDaysMin: r.etaMin, etaDaysMax: r.etaMax },
        { provinceCode: p.code, minGrams: 5000, maxGrams: 20000, priceCents: r.third, etaDaysMin: r.etaMin, etaDaysMax: r.etaMax },
      ],
    });
  }

  // Atributos
  const attrDefs = [
    { key: "talla", name: "Talla", type: "LIST", isVariant: true, isFilterable: true },
    { key: "color", name: "Color", type: "COLOR", isVariant: true, isFilterable: true },
    { key: "material", name: "Material", type: "TEXT", isVariant: false, isFilterable: false },
    { key: "medidas", name: "Medidas", type: "TEXT", isVariant: false, isFilterable: false },
    { key: "voltaje", name: "Voltaje", type: "LIST", options: ["110 V", "220 V", "110-220 V"], isVariant: false, isFilterable: true },
    { key: "edad_recomendada", name: "Edad recomendada", type: "LIST", options: ["0-2 años", "3-5 años", "6-8 años", "9-12 años", "13+ años"], isVariant: false, isFilterable: true },
  ] as const;
  const attrs: Record<string, string> = {};
  for (const a of attrDefs) {
    const row = await prisma.attributeDef.upsert({
      where: { key: a.key },
      create: { ...a, options: "options" in a ? [...a.options] : [] },
      update: {},
    });
    attrs[a.key] = row.id;
  }

  // Guías de tallas
  const guideIds: Record<string, string> = {};
  await prisma.category.updateMany({ data: { sizeGuideId: null } });
  await prisma.sizeGuide.deleteMany();
  for (const [key, g] of Object.entries(SIZE_GUIDES)) {
    const row = await prisma.sizeGuide.create({
      data: { name: g.name, columns: [...g.columns], rows: g.rows.map((r) => ({ label: r[0], values: r.slice(1) })) },
    });
    guideIds[key] = row.id;
  }

  // Árbol de categorías
  const leaves: Leaf[] = [];
  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const top = await prisma.category.upsert({
      where: { path: slug },
      create: {
        level: 1, path: slug, slug, name: c.name, position: i,
        isRegulated: !!c.regulated, acceptedDocTypes: c.regulated ?? [],
        sizeGuideId: c.guide ? guideIds[c.guide] : null,
      },
      update: { name: c.name, position: i, isRegulated: !!c.regulated, acceptedDocTypes: c.regulated ?? [], sizeGuideId: c.guide ? guideIds[c.guide] : null },
    });
    const attrKeys =
      c.guide ? ["talla", "color", "material"]
      : slug === "electrodomesticos" || slug === "electronica" ? ["voltaje", "color"]
      : slug === "juguetes-y-juegos" ? ["edad-recomendada".replace("-", "_"), "material"]
      : ["color", "material", "medidas"];
    for (const [pos, k] of attrKeys.entries()) {
      await prisma.categoryAttr.upsert({
        where: { categoryId_attributeId: { categoryId: top.id, attributeId: attrs[k] } },
        create: { categoryId: top.id, attributeId: attrs[k], position: pos },
        update: {},
      });
    }
    for (const [j, subName] of c.children.entries()) {
      const subSlug = slugify(subName.replace(/\s*\(.*\)$/, ""));
      const path = `${slug}/${subSlug}`;
      const sub = await prisma.category.upsert({
        where: { path },
        create: { level: 2, parentId: top.id, path, slug: subSlug, name: subName, position: j },
        update: { name: subName, position: j },
      });
      leaves.push({ id: sub.id, topSlug: slug, subName, docs: c.regulated ?? null });
    }
  }

  // Proveedores ficticios (3 nacionales, 3 internacionales)
  const supplierSeeds = [
    { tradeName: "Distribuidora Andina (demo)", origin: "NACIONAL", country: "Ecuador", province: "Pichincha", days: 2 },
    { tradeName: "Importadora Costa Azul (demo)", origin: "NACIONAL", country: "Ecuador", province: "Guayas", days: 3 },
    { tradeName: "Mayorista Austro (demo)", origin: "NACIONAL", country: "Ecuador", province: "Azuay", days: 3 },
    { tradeName: "Shenzhen Trading (demo)", origin: "INTERNACIONAL", country: "China", province: null, days: 18 },
    { tradeName: "Miami Wholesale (demo)", origin: "INTERNACIONAL", country: "Estados Unidos", province: null, days: 12 },
    { tradeName: "Bogotá Mayoristas (demo)", origin: "INTERNACIONAL", country: "Colombia", province: null, days: 10 },
  ] as const;
  const suppliers = [];
  for (const s of supplierSeeds) {
    const existing = await prisma.supplier.findFirst({ where: { tradeName: s.tradeName } });
    const row =
      existing ??
      (await prisma.supplier.create({
        data: { legalName: s.tradeName, tradeName: s.tradeName, origin: s.origin, country: s.country, province: s.province, defaultLeadDays: s.days, email: "proveedor@ejemplo.invalid" },
      }));
    suppliers.push({ id: row.id, origin: row.origin });
  }

  // Marcas ficticias (no imitan marcas reales)
  const brandNames = ["Kuntur Wear", "Inti Home", "Sumak Tech", "Wayra Sport", "Allpa Garden"];
  const brandIds: string[] = [];
  for (const name of brandNames) brandIds.push((await prisma.brand.upsert({ where: { name }, create: { name }, update: {} })).id);

  // Productos de demostración (solo si el catálogo está vacío)
  if ((await prisma.product.count()) === 0) {
    const b = genProducts(300, leaves, suppliers, brandIds, "d");
    await insertBatch(prisma, b);
    // Un producto regulado con documento vencido: se suspende (demuestra la regla).
    const withDoc = await prisma.complianceDoc.findFirst({ orderBy: { createdAt: "asc" } });
    if (withDoc) {
      await prisma.complianceDoc.update({ where: { id: withDoc.id }, data: { expiresAt: new Date(Date.now() - 5 * 86_400_000) } });
      await prisma.product.update({ where: { id: withDoc.productId }, data: { status: "SUSPENDED" } });
    }
  }

  // Administrador inicial
  const email = (process.env.ADMIN_EMAIL ?? "admin@chasqui.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) throw new Error("Define ADMIN_PASSWORD (mínimo 12 caracteres) en .env");
  await prisma.user.upsert({
    where: { email },
    create: { email, name: "Administrador", role: "ADMIN", passwordHash: await hash(password, { algorithm: 2 }) },
    update: {},
  });

  console.log(`Listo: ${await prisma.category.count()} categorías, ${await prisma.product.count()} productos, admin ${email}`);
}

main().finally(() => prisma.$disconnect());
