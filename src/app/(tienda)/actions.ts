"use server";
/**
 * Acciones públicas de la tienda. Son endpoints públicos: validan todo con zod,
 * limitan intentos por IP y nunca confían en precios ni totales enviados por el navegador.
 * (Next.js verifica el origen de las Server Actions: protección CSRF integrada.)
 */
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { allow } from "@/lib/ratelimit";
import { clientIp } from "@/lib/auth";
import { isValidIdNumber, normalizeEcMobile } from "@/lib/validation";
import { CheckoutError, createOrder, findOrderForTracking, quote } from "@/modules/orders";
import { processOutbox } from "@/modules/notifications";

const itemsSchema = z.array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(10) })).min(1).max(30);

export type CartLineView = {
  variantId: string; productId: string; slug: string; title: string; optionsText: string;
  image: string | null; priceCents: number; compareAtCents: number | null; stock: number; qty: number;
};

/** Datos actuales (precio, stock, foto) de lo que hay en el carrito. */
export async function getCartLines(raw: unknown): Promise<{ lines: CartLineView[]; removed: number }> {
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) return { lines: [], removed: 0 };
  const variants = await prisma.variant.findMany({
    where: { id: { in: parsed.data.map((i) => i.variantId) }, active: true, product: { status: "PUBLISHED" } },
    include: { product: { select: { id: true, slug: true, title: true, images: { orderBy: { position: "asc" }, take: 1 } } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: CartLineView[] = [];
  for (const it of parsed.data) {
    const v = byId.get(it.variantId);
    if (!v) continue;
    lines.push({
      variantId: v.id, productId: v.product.id, slug: v.product.slug, title: v.product.title,
      optionsText: Object.values(v.options as Record<string, string>).join(" / "),
      image: v.product.images[0]?.url ?? null, priceCents: v.priceCents, compareAtCents: v.compareAtCents,
      stock: v.stock, qty: Math.min(it.qty, Math.max(v.stock, 1)),
    });
  }
  return { lines, removed: parsed.data.length - lines.length };
}

export async function getQuote(rawItems: unknown, provinceCode: string) {
  const items = itemsSchema.safeParse(rawItems);
  if (!items.success || !/^\d{2}$/.test(provinceCode)) return null;
  const q = await quote(items.data, provinceCode);
  return {
    subtotalCents: q.totals.subtotalCents, shippingCents: q.totals.shippingCents, totalCents: q.totals.totalCents,
    taxCents: q.totals.taxCents, freeShipping: q.totals.freeShipping, hasRates: q.hasRates, problems: q.problems,
    etaMax: Math.max(0, ...Object.values(q.totals.etaBySupplier).map((e) => e.max)),
  };
}

export async function getWishlist(ids: unknown) {
  const parsed = z.array(z.string().max(40)).max(60).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) return [];
  return prisma.$queryRaw<import("@/modules/catalog").ProductCard[]>`
    SELECT p."id", p."slug", p."title", p."priceCents", p."compareAtCents", p."ratingAvg", p."ratingCount", p."soldCount",
      p."totalStock", p."leadDaysMin", p."leadDaysMax",
      (SELECT i."url" FROM "ProductImage" i WHERE i."productId" = p."id" ORDER BY i."position" LIMIT 1) AS "image",
      (SELECT b."name" FROM "Brand" b WHERE b."id" = p."brandId") AS "brand"
    FROM "Product" p WHERE p."status" = 'PUBLISHED' AND p."id" = ANY(${parsed.data})`;
}

const clean = (max: number, min = 1) => z.string().trim().min(min, "Campo obligatorio").max(max);

const checkoutSchema = z.object({
  name: clean(80, 3).refine((v) => v.split(/\s+/).length >= 2, "Escribe tu nombre y apellido"),
  idNumber: z.string().trim().refine(isValidIdNumber, "Cédula o RUC no válido"),
  phone: z.string().trim().transform((v, ctx) => {
    const n = normalizeEcMobile(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Ingresa un celular válido, por ejemplo 0991234567" });
    return n ?? "";
  }),
  email: z.string().trim().max(120).email("Correo no válido").optional().or(z.literal("")),
  provinceCode: z.string().regex(/^\d{2}$/, "Selecciona una provincia"),
  city: clean(60, 2),
  address: clean(160, 5),
  reference: clean(160, 3),
  notes: z.string().trim().max(300).optional(),
  consent: z.literal("on", { message: "Debes aceptar el aviso de privacidad para continuar" }),
});

/** `values` devuelve lo que escribió la persona: React 19 vacía el formulario tras cada envío, y no queremos que tenga que reescribir todo por un error. */
export type CheckoutState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

const KEPT_FIELDS = ["name", "idNumber", "phone", "email", "provinceCode", "city", "address", "reference", "notes", "consent"];
const keep = (fd: FormData) => Object.fromEntries(KEPT_FIELDS.map((k) => [k, String(fd.get(k) ?? "")]));

const CHANNELS = { facebook: "FACEBOOK", instagram: "INSTAGRAM", tiktok: "TIKTOK", whatsapp: "WHATSAPP" } as const;

export async function placeOrder(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const data = checkoutSchema.safeParse(Object.fromEntries(fd));
  if (!data.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of data.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Revisa los datos marcados.", fieldErrors, values: keep(fd) };
  }
  let items: z.infer<typeof itemsSchema>;
  let utm: Record<string, string> | undefined;
  try {
    items = itemsSchema.parse(JSON.parse(String(fd.get("items"))));
    const raw = JSON.parse(String(fd.get("utm") || "{}"));
    utm = z.record(z.string(), z.string().max(100)).parse(raw);
  } catch {
    return { error: "No pudimos leer tu carrito. Vuelve al carrito e inténtalo de nuevo.", values: keep(fd) };
  }

  // El límite cuenta solo envíos válidos: equivocarse al escribir no bloquea a nadie.
  const ip = await clientIp();
  if (!(await allow(`order:${ip}`, 8, 3600))) return { error: "Hiciste muchos pedidos seguidos. Intenta de nuevo en una hora o escríbenos por WhatsApp.", values: keep(fd) };

  const source = (utm?.utm_source ?? "").toLowerCase();
  const channel = (Object.entries(CHANNELS).find(([k]) => source.includes(k))?.[1] ?? "WEB") as "WEB" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "WHATSAPP";
  const { consent: _c, ...customer } = data.data;
  void _c;

  let result;
  try {
    result = await createOrder({ customer, items, channel, utm: utm && Object.keys(utm).length ? utm : undefined });
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, values: keep(fd) };
    console.error("[checkout]", e);
    return { error: "No pudimos registrar tu pedido. Inténtalo de nuevo en un momento.", values: keep(fd) };
  }
  // Enviar el WhatsApp de "pedido recibido" sin hacer esperar al cliente.
  after(() => processOutbox(5).catch((e) => console.error("[outbox]", e)));
  redirect(`/pedido/${result.token}?nuevo=1`);
}

export type TrackState = { error?: string; number?: string; last4?: string } | null;

export async function lookupOrder(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const ip = await clientIp();
  const number = String(fd.get("number") ?? "").slice(0, 20);
  const last4 = String(fd.get("last4") ?? "").replace(/\D/g, "").slice(0, 4);
  const kept = { number, last4 }; // React vacía el formulario tras cada envío: devolvemos lo escrito
  if (!(await allow(`track:${ip}`, 10, 600))) return { error: "Demasiadas consultas. Espera unos minutos.", ...kept };
  if (!number || last4.length !== 4) return { error: "Ingresa el número de pedido y los últimos 4 dígitos de tu celular.", ...kept };
  const token = await findOrderForTracking(number, last4);
  if (!token) return { error: "No encontramos un pedido con esos datos. Revisa el número y el celular.", ...kept };
  redirect(`/pedido/${token}`);
}
