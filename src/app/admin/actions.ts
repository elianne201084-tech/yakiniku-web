"use server";
/**
 * Acciones del panel. Cada una empieza con requireRole(): la interfaz oculta botones,
 * pero la autorización real se comprueba aquí, en el servidor.
 */
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { login, logout, requireRole } from "@/lib/auth";
import { parseUSDToCents } from "@/lib/money";
import { saveSettings, getSettings } from "@/lib/settings";
import { CheckoutError, setOrderStatus } from "@/modules/orders";
import { processOutbox } from "@/modules/notifications";
import { publishProduct, slugify, syncProductDenorm } from "@/modules/products";
import type { DocType, OrderStatus } from "@/generated/prisma/enums";

const STAFF = ["ADMIN", "OPERATOR"] as const;
const bust = () => { revalidateTag("categories", "max"); revalidateTag("products", "max"); };
const back = (path: string, kind: "ok" | "error", msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string, d = 0) => { const n = parseInt(str(fd, k), 10); return Number.isFinite(n) ? n : d; };

// ---------------------------------------------------------------- sesión
export async function loginAction(_p: { error?: string; email?: string } | null, fd: FormData) {
  const r = await login(str(fd, "email"), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error, email: str(fd, "email") }; // React vacía el formulario: devolvemos el correo
  redirect("/admin");
}
export async function logoutAction() { await logout(); redirect("/admin/login"); }

// ---------------------------------------------------------------- pedidos
export async function orderStatusAction(fd: FormData) {
  const s = await requireRole(...STAFF);
  const id = str(fd, "orderId");
  const path = `/admin/pedidos/${id}`;
  try {
    await setOrderStatus(id, str(fd, "to") as OrderStatus, s.userId, { carrier: str(fd, "carrier") || undefined, trackingCode: str(fd, "trackingCode") || undefined });
  } catch (e) {
    if (e instanceof CheckoutError) back(path, "error", e.message);
    throw e;
  }
  after(() => processOutbox(10).catch((e) => console.error("[outbox]", e)));
  back(path, "ok", "Estado actualizado. El cliente recibirá el aviso por WhatsApp.");
}

export async function retryNotificationsAction(fd: FormData) {
  await requireRole(...STAFF);
  const id = str(fd, "orderId");
  await prisma.notification.updateMany({ where: { orderId: id, status: { in: ["FAILED", "PENDING"] } }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date() } });
  await processOutbox(10);
  back(`/admin/pedidos/${id}`, "ok", "Se reintentó el envío de mensajes.");
}

// ---------------------------------------------------------------- categorías (solo ADMIN)
const DOC_TYPES = ["REGISTRO_SANITARIO", "NOTIFICACION_SANITARIA", "CERTIFICADO_INEN", "HOMOLOGACION_ARCOTEL", "OTRO"] as const;

export async function createCategoryAction(fd: FormData) {
  await requireRole("ADMIN");
  const name = str(fd, "name");
  const parentId = str(fd, "parentId") || null;
  if (name.length < 2) back("/admin/categorias", "error", "Escribe el nombre de la categoría.");
  const parent = parentId ? await prisma.category.findUnique({ where: { id: parentId } }) : null;
  if (parent && parent.level >= 3) back("/admin/categorias", "error", "Solo se permiten tres niveles.");
  const slug = slugify(name);
  const path = parent ? `${parent.path}/${slug}` : slug;
  if (await prisma.category.findUnique({ where: { path } })) back("/admin/categorias", "error", "Ya existe una categoría con ese nombre en este nivel.");
  const siblings = await prisma.category.count({ where: { parentId } });
  await prisma.category.create({ data: { name, slug, path, parentId, level: (parent?.level ?? 0) + 1, position: siblings } });
  bust();
  back("/admin/categorias", "ok", `Categoría "${name}" creada.`);
}

export async function updateCategoryAction(fd: FormData) {
  const s = await requireRole("ADMIN");
  const id = str(fd, "id");
  const accepted = fd.getAll("docTypes").map(String).filter((d): d is DocType => (DOC_TYPES as readonly string[]).includes(d));
  const data = {
    name: str(fd, "name"), position: int(fd, "position"),
    isVisible: fd.get("isVisible") === "on", isRegulated: fd.get("isRegulated") === "on", acceptedDocTypes: accepted,
  };
  if (data.name.length < 2) back("/admin/categorias", "error", "El nombre es muy corto.");
  await prisma.category.update({ where: { id }, data });
  await prisma.auditLog.create({ data: { userId: s.userId, entity: "Category", entityId: id, action: "update", diff: data } });
  bust();
  back("/admin/categorias", "ok", "Categoría guardada.");
}

export async function deleteCategoryAction(fd: FormData) {
  await requireRole("ADMIN");
  const id = str(fd, "id");
  const [kids, prods] = await Promise.all([prisma.category.count({ where: { parentId: id } }), prisma.product.count({ where: { categoryId: id } })]);
  if (kids || prods) back("/admin/categorias", "error", "No se puede eliminar: tiene subcategorías o productos. Puedes ocultarla.");
  await prisma.category.delete({ where: { id } });
  bust();
  back("/admin/categorias", "ok", "Categoría eliminada.");
}

// ---------------------------------------------------------------- productos
const productSchema = z.object({
  title: z.string().trim().min(5, "El título es muy corto").max(160),
  supplierId: z.string().min(1, "Elige un proveedor"),
  categoryId: z.string().min(1, "Elige una categoría"),
  description: z.string().trim().max(5000),
  leadDaysMin: z.coerce.number().int().min(0).max(90),
  leadDaysMax: z.coerce.number().int().min(0).max(120),
  weightGrams: z.coerce.number().int().min(1).max(100000),
  brandDeclaration: z.enum(["ORIGINAL_AUTORIZADO", "GENERICO_SIN_MARCA"]),
});

export async function saveProductAction(fd: FormData) {
  const s = await requireRole(...STAFF);
  const id = str(fd, "id");
  const here = id ? `/admin/productos/${id}` : "/admin/productos/nuevo";
  const p = productSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return back(here, "error", p.error.issues[0].message);
  if (p.data.leadDaysMax < p.data.leadDaysMin) return back(here, "error", "El plazo máximo no puede ser menor al mínimo.");

  // Marca: la existente o una nueva escrita a mano.
  const newBrand = str(fd, "newBrand");
  let brandId = str(fd, "brandId") || null;
  if (newBrand) brandId = (await prisma.brand.upsert({ where: { name: newBrand }, create: { name: newBrand }, update: {} })).id;
  if (p.data.brandDeclaration === "GENERICO_SIN_MARCA") brandId = null;
  const declared = fd.get("declare") === "on";

  const base = {
    ...p.data, brandId, isRecommended: fd.get("isRecommended") === "on",
  };
  if (id) {
    const prev = await prisma.product.findUniqueOrThrow({ where: { id } });
    await prisma.product.update({ where: { id }, data: { ...base, declaredAt: declared ? prev.declaredAt ?? new Date() : null } });
    await prisma.auditLog.create({ data: { userId: s.userId, entity: "Product", entityId: id, action: "update" } });
    bust();
    return back(here, "ok", "Producto guardado.");
  }
  const created = await prisma.product.create({
    data: { ...base, slug: `${slugify(p.data.title)}-${Date.now().toString(36)}`, declaredAt: declared ? new Date() : null, status: "DRAFT" },
  });
  await prisma.auditLog.create({ data: { userId: s.userId, entity: "Product", entityId: created.id, action: "create" } });
  return back(`/admin/productos/${created.id}`, "ok", "Producto creado como borrador. Agrega variantes, fotos y documentos para publicarlo.");
}

function parseOptions(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(/[;,\n]/)) {
    const [k, ...v] = part.split("=");
    if (k && v.length) out[slugify(k).replace(/-/g, "_")] = v.join("=").trim();
  }
  return out;
}

export async function saveVariantAction(fd: FormData) {
  await requireRole(...STAFF);
  const productId = str(fd, "productId");
  const here = `/admin/productos/${productId}`;
  const cost = parseUSDToCents(str(fd, "cost")), price = parseUSDToCents(str(fd, "price"));
  const compare = str(fd, "compareAt") ? parseUSDToCents(str(fd, "compareAt")) : null;
  if (cost === null || price === null || (str(fd, "compareAt") && compare === null)) return back(here, "error", "Revisa costo y precio: deben ser montos válidos.");
  if (price < cost) return back(here, "error", "El precio de venta no puede ser menor al costo.");
  const data = { options: parseOptions(str(fd, "options")), costCents: cost, priceCents: price, compareAtCents: compare, stock: Math.max(0, int(fd, "stock")), active: fd.get("active") === "on", supplierSku: str(fd, "supplierSku") || null };
  const id = str(fd, "id");
  try {
    if (id) await prisma.variant.update({ where: { id }, data });
    else await prisma.variant.create({ data: { ...data, productId, sku: str(fd, "sku") || `SKU-${Date.now().toString(36).toUpperCase()}`, active: true } });
  } catch {
    return back(here, "error", "No se pudo guardar la variante (¿SKU repetido?).");
  }
  await syncProductDenorm(prisma, productId);
  bust();
  return back(here, "ok", "Variante guardada.");
}

export async function saveImagesAction(fd: FormData) {
  await requireRole(...STAFF);
  const productId = str(fd, "productId");
  const urls = str(fd, "urls").split(/\s+/).filter(Boolean).slice(0, 12);
  if (urls.some((u) => !/^(https:\/\/|\/placeholder\/)/.test(u))) return back(`/admin/productos/${productId}`, "error", "Las imágenes deben ser URL https://.");
  const title = (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).title;
  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId } }),
    prisma.productImage.createMany({ data: urls.map((url, position) => ({ productId, url, position, alt: title })) }),
  ]);
  bust();
  return back(`/admin/productos/${productId}`, "ok", "Imágenes guardadas.");
}

export async function addDocAction(fd: FormData) {
  const s = await requireRole(...STAFF);
  const productId = str(fd, "productId");
  const here = `/admin/productos/${productId}`;
  const expiresAt = new Date(str(fd, "expiresAt"));
  const type = str(fd, "type");
  if (!(DOC_TYPES as readonly string[]).includes(type)) return back(here, "error", "Elige el tipo de documento.");
  if (!str(fd, "number") || Number.isNaN(expiresAt.getTime())) return back(here, "error", "Indica el número y la fecha de vigencia del documento.");
  if (!/^https:\/\//.test(str(fd, "fileUrl"))) return back(here, "error", "El archivo del documento debe ser una URL https://.");
  await prisma.complianceDoc.create({
    data: { productId, type: type as DocType, number: str(fd, "number"), issuer: str(fd, "issuer"), issuedAt: str(fd, "issuedAt") ? new Date(str(fd, "issuedAt")) : null, expiresAt, fileUrl: str(fd, "fileUrl"), review: "APPROVED" },
  });
  await prisma.auditLog.create({ data: { userId: s.userId, entity: "Product", entityId: productId, action: "doc-added", diff: { type, number: str(fd, "number") } } });
  return back(here, "ok", "Documento agregado.");
}

export async function deleteDocAction(fd: FormData) {
  await requireRole(...STAFF);
  const doc = await prisma.complianceDoc.delete({ where: { id: str(fd, "id") } });
  return back(`/admin/productos/${doc.productId}`, "ok", "Documento eliminado.");
}

export async function publishAction(fd: FormData) {
  const s = await requireRole(...STAFF);
  const id = str(fd, "id");
  const r = await publishProduct(id);
  if (!r.ok) return back(`/admin/productos/${id}`, "error", `No se puede publicar: ${r.errors.join(" ")}`);
  await prisma.auditLog.create({ data: { userId: s.userId, entity: "Product", entityId: id, action: "publish" } });
  bust();
  return back(`/admin/productos/${id}`, "ok", "Producto publicado.");
}

export async function suspendAction(fd: FormData) {
  const s = await requireRole(...STAFF);
  const id = str(fd, "id");
  await prisma.product.update({ where: { id }, data: { status: "SUSPENDED" } });
  await prisma.auditLog.create({ data: { userId: s.userId, entity: "Product", entityId: id, action: "suspend" } });
  bust();
  return back(`/admin/productos/${id}`, "ok", "Producto despublicado.");
}

// ---------------------------------------------------------------- configuración (solo ADMIN)
export async function saveSettingsAction(fd: FormData) {
  const s = await requireRole("ADMIN");
  const cur = await getSettings();
  const iva = Number(str(fd, "ivaPercent").replace(",", "."));
  const free = str(fd, "freeShipping") ? parseUSDToCents(str(fd, "freeShipping")) : 0;
  if (!Number.isFinite(iva) || iva < 0 || iva > 30 || free === null) return back("/admin/configuracion", "error", "Revisa el IVA y el monto de envío gratis.");
  const pixel = (k: string) => str(fd, k).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const policiesChanged = ["privacy"].some((k) => str(fd, `policy_${k}`) !== cur.policies.privacy);
  await saveSettings({
    ...cur,
    storeName: str(fd, "storeName") || cur.storeName, tagline: str(fd, "tagline"),
    company: { legalName: str(fd, "legalName"), ruc: str(fd, "ruc"), address: str(fd, "address"), phone: str(fd, "phone"), email: str(fd, "email"), whatsapp: str(fd, "whatsapp").replace(/\D/g, "") },
    ivaPercent: iva, freeShippingOverCents: free,
    pixels: { metaPixelId: pixel("metaPixelId"), tiktokPixelId: pixel("tiktokPixelId") },
    // Si cambia el aviso de privacidad se sube la versión: los nuevos pedidos registran la versión aceptada.
    consentVersion: policiesChanged ? new Date().toISOString().slice(0, 10) : cur.consentVersion,
    policies: { returns: str(fd, "policy_returns"), warranty: str(fd, "policy_warranty"), privacy: str(fd, "policy_privacy"), terms: str(fd, "policy_terms") },
  });
  await prisma.auditLog.create({ data: { userId: s.userId, entity: "Setting", entityId: "store", action: "update" } });
  back("/admin/configuracion", "ok", "Configuración guardada.");
}
