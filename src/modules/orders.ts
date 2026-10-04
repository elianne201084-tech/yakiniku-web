import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { computeTotals, type Line, type Rate } from "@/lib/pricing";
import { formatUSD } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { splitBySupplier } from "@/lib/pricing";
import { enqueueWhatsApp } from "./notifications";
import { syncProductDenorm } from "./products";
import type { OrderChannel, OrderStatus } from "@/generated/prisma/enums";
import type { TemplateName } from "@/lib/whatsapp/templates";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Nuevo",
  CONFIRMED: "Confirmado",
  SENT_TO_SUPPLIER: "Enviado al proveedor",
  DISPATCHED: "Despachado",
  DELIVERED: "Entregado",
  RETURNED: "Devuelto",
  CANCELLED: "Cancelado",
};

/** Transiciones permitidas. Un pedido cancelado o devuelto es final. */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SENT_TO_SUPPLIER", "CANCELLED"],
  SENT_TO_SUPPLIER: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

const STATUS_TEMPLATE: Partial<Record<OrderStatus, TemplateName>> = {
  CONFIRMED: "pedido_confirmado",
  SENT_TO_SUPPLIER: "pedido_enviado_proveedor",
  DISPATCHED: "pedido_despachado",
  DELIVERED: "pedido_entregado",
  CANCELLED: "pedido_cancelado",
  RETURNED: "pedido_devuelto",
};

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const trackingUrl = (token: string) => `${siteUrl()}/pedido/${token}`;
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

export type CheckoutInput = {
  customer: {
    name: string;
    idNumber: string;
    phone: string; // ya normalizado: 593XXXXXXXXX
    email?: string;
    provinceCode: string;
    city: string;
    address: string;
    reference: string;
    notes?: string;
  };
  items: { variantId: string; qty: number }[];
  channel: OrderChannel;
  utm?: Record<string, string>;
};

export class CheckoutError extends Error {}

/** Carga las líneas reales desde la BD (nunca confiamos en precios del navegador). */
export async function resolveLines(items: { variantId: string; qty: number }[]) {
  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: { include: { supplier: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const problems: string[] = [];
  const lines: (Line & { title: string; optionsText: string; stock: number })[] = [];
  for (const it of items) {
    const v = byId.get(it.variantId);
    if (!v || !v.active || v.product.status !== "PUBLISHED" || !v.product.supplier.active) {
      problems.push("Un producto de tu carrito ya no está disponible.");
      continue;
    }
    if (v.stock < it.qty) {
      problems.push(`"${v.product.title}" solo tiene ${v.stock} unidad(es) disponibles.`);
      continue;
    }
    lines.push({
      variantId: v.id,
      productId: v.productId,
      supplierId: v.product.supplierId,
      qty: it.qty,
      unitPrice: v.priceCents,
      unitCost: v.costCents,
      weightGrams: v.weightGrams ?? v.product.weightGrams,
      title: v.product.title,
      optionsText: Object.values(v.options as Record<string, string>).join(" / "),
      stock: v.stock,
    });
  }
  return { lines, problems };
}

export async function ratesFor(provinceCode: string): Promise<Rate[]> {
  return prisma.shippingRate.findMany({ where: { provinceCode }, orderBy: { maxGrams: "asc" } });
}

export async function quote(items: { variantId: string; qty: number }[], provinceCode: string) {
  const [{ lines, problems }, rates, settings] = await Promise.all([resolveLines(items), ratesFor(provinceCode), getSettings()]);
  const totals = computeTotals({
    lines,
    rates,
    freeShippingOverCents: settings.freeShippingOverCents,
    ivaPercent: settings.ivaPercent,
  });
  return { lines, problems, totals, hasRates: rates.length > 0 };
}

export async function createOrder(input: CheckoutInput): Promise<{ number: string; token: string }> {
  const province = await prisma.province.findUnique({ where: { code: input.customer.provinceCode } });
  if (!province) throw new CheckoutError("Selecciona una provincia válida.");
  if (input.items.length === 0) throw new CheckoutError("Tu carrito está vacío.");

  const q = await quote(input.items, province.code);
  if (q.problems.length) throw new CheckoutError(q.problems[0]);
  if (!q.hasRates) throw new CheckoutError("Aún no tenemos tarifa de envío para tu provincia. Escríbenos por WhatsApp.");
  const settings = await getSettings();
  const token = randomBytes(16).toString("base64url");

  return prisma.$transaction(async (tx) => {
    // Descontar stock de forma atómica: si otro cliente compró primero, falla y se revierte todo.
    for (const l of q.lines) {
      const r = await tx.variant.updateMany({
        where: { id: l.variantId, stock: { gte: l.qty } },
        data: { stock: { decrement: l.qty } },
      });
      if (r.count === 0) throw new CheckoutError(`"${l.title}" se agotó mientras comprabas. Revisa tu carrito.`);
    }
    for (const pid of new Set(q.lines.map((l) => l.productId))) await syncProductDenorm(tx, pid);

    const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
    const number = `CH-${n}`;
    const t = q.totals;

    const order = await tx.order.create({
      data: {
        number,
        trackingToken: token,
        channel: input.channel,
        utm: input.utm,
        customerName: input.customer.name,
        idNumber: input.customer.idNumber,
        phone: input.customer.phone,
        email: input.customer.email || null,
        provinceCode: province.code,
        provinceName: province.name,
        city: input.customer.city,
        address: input.customer.address,
        reference: input.customer.reference,
        notes: input.customer.notes || null,
        subtotalCents: t.subtotalCents,
        shippingCents: t.shippingCents,
        totalCents: t.totalCents,
        taxCents: t.taxCents,
        paymentMethod: "COD",
        privacyConsentAt: new Date(),
        consentVersion: settings.consentVersion,
        payments: { create: { method: "COD", amount: t.totalCents } },
        subOrders: {
          create: [...splitBySupplier(q.lines)].map(([supplierId, lines]) => ({
            supplierId,
            shippingCents: t.shippingBySupplier[supplierId] ?? 0,
            items: {
              create: lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                titleSnapshot: l.title,
                optionsText: l.optionsText,
                qty: l.qty,
                unitPrice: l.unitPrice,
                unitCost: l.unitCost,
              })),
            },
          })),
        },
      },
    });

    await enqueueWhatsApp(tx, {
      orderId: order.id,
      to: input.customer.phone,
      template: "pedido_recibido",
      vars: [firstName(input.customer.name), number, formatUSD(t.totalCents), trackingUrl(token)],
    });
    return { number, token };
  });
}

/** Cambia el estado del pedido (y de sus sub-pedidos), ajusta stock y avisa al cliente por WhatsApp. */
export async function setOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: string,
  opts: { carrier?: string; trackingCode?: string } = {},
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { subOrders: { include: { items: true } } },
    });
    if (!order) throw new CheckoutError("Pedido no encontrado.");
    if (!NEXT_STATUS[order.status].includes(to)) {
      throw new CheckoutError(`No se puede pasar de "${STATUS_LABEL[order.status]}" a "${STATUS_LABEL[to]}".`);
    }
    if (to === "DISPATCHED" && !(opts.carrier && opts.trackingCode)) {
      throw new CheckoutError("Para despachar indica la empresa de courier y el número de guía.");
    }
    const now = new Date();

    await tx.order.update({
      where: { id: orderId },
      data: { status: to, confirmedAt: to === "CONFIRMED" ? now : undefined },
    });
    await tx.subOrder.updateMany({
      where: { orderId },
      data: {
        status: to,
        carrier: to === "DISPATCHED" ? opts.carrier : undefined,
        trackingCode: to === "DISPATCHED" ? opts.trackingCode : undefined,
        dispatchedAt: to === "DISPATCHED" ? now : undefined,
        deliveredAt: to === "DELIVERED" ? now : undefined,
        supplierNotifiedAt: to === "SENT_TO_SUPPLIER" ? now : undefined,
      },
    });

    const items = order.subOrders.flatMap((s) => s.items);
    if (to === "CANCELLED") {
      // Devolver el stock reservado.
      for (const it of items) await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: it.qty } } });
      for (const pid of new Set(items.map((i) => i.productId))) await syncProductDenorm(tx, pid);
      await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED" } });
    }
    if (to === "DELIVERED") {
      for (const it of items) await tx.product.update({ where: { id: it.productId }, data: { soldCount: { increment: it.qty } } });
      await tx.payment.updateMany({ where: { orderId, method: "COD", status: "PENDING" }, data: { status: "PAID" } });
    }

    const template = STATUS_TEMPLATE[to];
    if (template) {
      const name = firstName(order.customerName);
      const url = trackingUrl(order.trackingToken);
      const vars: Partial<Record<TemplateName, string[]>> = {
        pedido_confirmado: [name, order.number, url],
        pedido_enviado_proveedor: [name, order.number, url],
        pedido_despachado: [name, order.number, opts.carrier ?? "", opts.trackingCode ?? "", url],
        pedido_entregado: [name, order.number],
        pedido_cancelado: [name, order.number],
        pedido_devuelto: [name, order.number],
      };
      await enqueueWhatsApp(tx, { orderId, to: order.phone, template, vars: vars[template]! });
    }
    await tx.auditLog.create({
      data: { entity: "Order", entityId: orderId, action: `status:${to}`, diff: { from: order.status, to, actor, ...opts } },
    });
  });
}

/** El cliente respondió "SI" por WhatsApp: confirma su pedido nuevo más reciente (últimos 7 días). */
export async function confirmByWhatsAppReply(phone: string): Promise<string | null> {
  const order = await prisma.order.findFirst({
    where: { phone, status: "NEW", createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (!order) return null;
  await setOrderStatus(order.id, "CONFIRMED", "cliente-whatsapp");
  return order.number;
}

/** Seguimiento público por número de pedido: exige además los últimos 4 dígitos del teléfono. */
export async function findOrderForTracking(number: string, phoneLast4: string) {
  const order = await prisma.order.findUnique({ where: { number: number.trim().toUpperCase() }, select: { trackingToken: true, phone: true } });
  if (!order || !order.phone.endsWith(phoneLast4.trim())) return null;
  return order.trackingToken;
}
