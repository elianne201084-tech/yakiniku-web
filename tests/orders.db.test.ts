import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { CheckoutError, confirmByWhatsAppReply, createOrder, setOrderStatus, findOrderForTracking } from "@/modules/orders";
import { processOutbox } from "@/modules/notifications";

const tag = `t${Date.now().toString(36)}`;
const ids: { suppliers: string[]; products: string[]; orders: string[]; cat?: string } = { suppliers: [], products: [], orders: [] };
let vA: string, vB: string, vScarce: string;

const customer = (phone = "593991230000") => ({
  name: "Cliente de Prueba", idNumber: "1710034065", phone, provinceCode: "17",
  city: "Quito", address: "Av. Siempre Viva 123", reference: "Frente al parque",
});

async function makeProduct(supplierId: string, categoryId: string, stock: number, price = 2500) {
  const p = await prisma.product.create({
    data: {
      supplierId, categoryId, title: `Producto ${tag}`, slug: `p-${tag}-${Math.random().toString(36).slice(2)}`,
      status: "PUBLISHED", weightGrams: 400, priceCents: price, totalStock: stock,
      variants: { create: { sku: `${tag}-${Math.random().toString(36).slice(2)}`, costCents: 1000, priceCents: price, stock, options: { color: "Negro" } } },
    },
    include: { variants: true },
  });
  ids.products.push(p.id);
  return p.variants[0].id;
}

beforeAll(async () => {
  const cat = await prisma.category.findFirstOrThrow({ where: { level: 2 } });
  ids.cat = cat.id;
  for (const n of ["A", "B"]) {
    const s = await prisma.supplier.create({ data: { legalName: `${tag}-${n}`, tradeName: `${tag}-${n}` } });
    ids.suppliers.push(s.id);
  }
  vA = await makeProduct(ids.suppliers[0], cat.id, 10);
  vB = await makeProduct(ids.suppliers[1], cat.id, 10);
  vScarce = await makeProduct(ids.suppliers[0], cat.id, 1);
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
  await prisma.orderItem.deleteMany({ where: { productId: { in: ids.products } } });
  await prisma.product.deleteMany({ where: { id: { in: ids.products } } });
  await prisma.supplier.deleteMany({ where: { id: { in: ids.suppliers } } });
  await prisma.$disconnect();
});

const stock = async (variantId: string) => (await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock;
async function place(items: { variantId: string; qty: number }[], phone?: string) {
  const r = await createOrder({ customer: customer(phone), items, channel: "WEB" });
  const o = await prisma.order.findUniqueOrThrow({ where: { number: r.number }, include: { subOrders: { include: { items: true } }, notifications: true, payments: true } });
  ids.orders.push(o.id);
  return o;
}

describe("crear pedido", () => {
  it("divide por proveedor, cobra un envío por sub-pedido y descuenta stock", async () => {
    const o = await place([{ variantId: vA, qty: 2 }, { variantId: vB, qty: 1 }]);
    expect(o.number).toMatch(/^CH-\d+$/);
    expect(o.status).toBe("NEW");
    expect(o.subOrders).toHaveLength(2);
    expect(o.subtotalCents).toBe(2500 * 3);
    expect(o.shippingCents).toBe(o.subOrders.reduce((s, x) => s + x.shippingCents, 0));
    expect(o.totalCents).toBe(o.subtotalCents + o.shippingCents);
    expect(o.payments[0]).toMatchObject({ method: "COD", status: "PENDING", amount: o.totalCents });
    expect(await stock(vA)).toBe(8);
    expect(await stock(vB)).toBe(9);
    // WhatsApp de "pedido recibido" queda en cola junto con el pedido.
    expect(o.notifications.map((n) => n.template)).toEqual(["pedido_recibido"]);
  });

  it("congela precio y costo en cada línea (margen real)", async () => {
    const o = await place([{ variantId: vA, qty: 1 }]);
    expect(o.subOrders[0].items[0]).toMatchObject({ unitPrice: 2500, unitCost: 1000, qty: 1 });
  });

  it("no vende más de lo que hay (dos compras simultáneas del último producto)", async () => {
    const results = await Promise.allSettled([
      createOrder({ customer: customer("593991230001"), items: [{ variantId: vScarce, qty: 1 }], channel: "WEB" }),
      createOrder({ customer: customer("593991230002"), items: [{ variantId: vScarce, qty: 1 }], channel: "WEB" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: expect.any(CheckoutError) });
    expect(await stock(vScarce)).toBe(0);
    for (const r of ok) if (r.status === "fulfilled") ids.orders.push((await prisma.order.findUniqueOrThrow({ where: { number: r.value.number } })).id);
  });

  it("rechaza carrito vacío, provincia inválida y producto inexistente", async () => {
    await expect(createOrder({ customer: customer(), items: [], channel: "WEB" })).rejects.toBeInstanceOf(CheckoutError);
    await expect(createOrder({ customer: { ...customer(), provinceCode: "99" }, items: [{ variantId: vA, qty: 1 }], channel: "WEB" })).rejects.toBeInstanceOf(CheckoutError);
    await expect(createOrder({ customer: customer(), items: [{ variantId: "no-existe", qty: 1 }], channel: "WEB" })).rejects.toBeInstanceOf(CheckoutError);
  });
});

describe("estados del pedido", () => {
  it("recorre el flujo completo y avisa por WhatsApp en cada paso", async () => {
    const o = await place([{ variantId: vA, qty: 1 }]);
    await setOrderStatus(o.id, "CONFIRMED", "test");
    await setOrderStatus(o.id, "SENT_TO_SUPPLIER", "test");
    await expect(setOrderStatus(o.id, "DISPATCHED", "test")).rejects.toThrow(/guía/);
    await setOrderStatus(o.id, "DISPATCHED", "test", { carrier: "Servientrega", trackingCode: "ABC123" });
    await setOrderStatus(o.id, "DELIVERED", "test");
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { notifications: true, payments: true, subOrders: true } });
    expect(after.status).toBe("DELIVERED");
    expect(after.payments[0].status).toBe("PAID");
    expect(after.subOrders[0]).toMatchObject({ carrier: "Servientrega", trackingCode: "ABC123" });
    expect(after.notifications.map((n) => n.template).sort()).toEqual(
      ["pedido_confirmado", "pedido_despachado", "pedido_enviado_proveedor", "pedido_entregado", "pedido_recibido"].sort(),
    );
    const despachado = after.notifications.find((n) => n.template === "pedido_despachado")!;
    expect((despachado.payload as { vars: string[] }).vars).toContain("ABC123");
  });

  it("no permite saltos de estado ni salir de un estado final", async () => {
    const o = await place([{ variantId: vA, qty: 1 }]);
    await expect(setOrderStatus(o.id, "DELIVERED", "test")).rejects.toThrow(/No se puede pasar/);
    await setOrderStatus(o.id, "CANCELLED", "test");
    await expect(setOrderStatus(o.id, "CONFIRMED", "test")).rejects.toThrow(CheckoutError);
  });

  it("cancelar devuelve el stock", async () => {
    const before = await stock(vB);
    const o = await place([{ variantId: vB, qty: 3 }]);
    expect(await stock(vB)).toBe(before - 3);
    await setOrderStatus(o.id, "CANCELLED", "test");
    expect(await stock(vB)).toBe(before);
  });

  it("el cliente confirma respondiendo SI por WhatsApp", async () => {
    const phone = "593991239999";
    const o = await place([{ variantId: vA, qty: 1 }], phone);
    expect(await confirmByWhatsAppReply(phone)).toBe(o.number);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("CONFIRMED");
    expect(await confirmByWhatsAppReply(phone)).toBeNull(); // ya no hay pedidos nuevos
  });
});

describe("seguimiento y cola de mensajes", () => {
  it("el seguimiento por número exige los últimos 4 dígitos del teléfono", async () => {
    const o = await place([{ variantId: vA, qty: 1 }], "593991235678");
    expect(await findOrderForTracking(o.number, "5678")).toBe(o.trackingToken);
    expect(await findOrderForTracking(o.number, "0000")).toBeNull();
    expect(await findOrderForTracking("CH-0", "5678")).toBeNull();
  });

  it("el procesador envía los pendientes y no repite los enviados", async () => {
    const o = await place([{ variantId: vA, qty: 1 }]);
    await processOutbox(500);
    const n = await prisma.notification.findFirstOrThrow({ where: { orderId: o.id } });
    expect(n.status).toBe("SENT");
    expect(n.sentAt).not.toBeNull();
    const again = await processOutbox(500);
    expect(again.sent).toBe(0);
  });
});
