import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatUSD } from "@/lib/money";
import { displayPhone } from "@/lib/validation";
import { STATUS_LABEL } from "@/modules/orders";
import { OrderPlaced } from "@/components/clear-cart";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp/link";

export const metadata: Metadata = { title: "Seguimiento de pedido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEPS = ["NEW", "CONFIRMED", "SENT_TO_SUPPLIER", "DISPATCHED", "DELIVERED"] as const;
const STEP_TEXT: Record<(typeof STEPS)[number], string> = {
  NEW: "Pedido recibido", CONFIRMED: "Confirmado", SENT_TO_SUPPLIER: "En preparación", DISPATCHED: "En camino", DELIVERED: "Entregado",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const { token } = await params;
  const isNew = (await searchParams).nuevo === "1";
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) notFound();
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { trackingToken: token }, include: { subOrders: { include: { items: true, supplier: { select: { origin: true } } } } } }),
    getSettings(),
  ]);
  if (!order) notFound();

  const final = order.status === "CANCELLED" || order.status === "RETURNED";
  const stepIdx = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const wa = waLink(settings.company.whatsapp, `Hola, consulto por mi pedido ${order.number}.`);
  const dispatched = order.subOrders.filter((s) => s.trackingCode);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {isNew && <OrderPlaced value={order.totalCents / 100} orderNumber={order.number} />}
      {isNew && (
        <div role="status" className="rounded-2xl bg-green-50 p-4 text-green-900">
          <p className="text-lg font-extrabold">¡Gracias, {order.customerName.split(" ")[0]}! Recibimos tu pedido.</p>
          <p className="mt-1 text-sm">Te enviamos un WhatsApp al {displayPhone(order.phone)}. <b>Respóndelo con “SI”</b> para confirmarlo y empezar a prepararlo.</p>
        </div>
      )}
      <div className="card p-4">
        <p className="text-sm text-ink-soft">Pedido</p>
        <h1 className="text-2xl font-extrabold">{order.number}</h1>
        {final ? (
          <p className="mt-2 rounded-lg bg-brand-50 p-3 font-bold text-brand-700">{STATUS_LABEL[order.status]}</p>
        ) : (
          <ol className="mt-4 space-y-3" aria-label="Estado del pedido">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i <= stepIdx ? "bg-green-600 text-white" : "bg-line text-ink-soft"}`} aria-hidden>{i <= stepIdx ? "✓" : i + 1}</span>
                <span className={i === stepIdx ? "font-extrabold" : i < stepIdx ? "" : "text-ink-soft"} aria-current={i === stepIdx ? "step" : undefined}>{STEP_TEXT[s]}</span>
              </li>
            ))}
          </ol>
        )}
        {dispatched.map((s) => (<p key={s.id} className="mt-3 rounded-lg bg-paper p-3 text-sm">Courier: <b>{s.carrier}</b> · Guía: <b>{s.trackingCode}</b></p>))}
        {order.status === "NEW" && <p className="mt-3 text-sm text-ink-soft">Aún no confirmamos tu pedido. Respóndenos “SI” en el WhatsApp que te enviamos.</p>}
      </div>

      <div className="card p-4">
        <h2 className="font-extrabold">Productos</h2>
        {order.subOrders.map((s) => (
          <ul key={s.id} className="mt-2 divide-y divide-line text-sm">
            {s.items.map((it) => (<li key={it.id} className="flex justify-between gap-2 py-2"><span>{it.qty}× {it.titleSnapshot}{it.optionsText ? ` (${it.optionsText})` : ""}</span><span>{formatUSD(it.unitPrice * it.qty)}</span></li>))}
          </ul>
        ))}
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatUSD(order.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{order.shippingCents ? formatUSD(order.shippingCents) : "Gratis"}</dd></div>
          <div className="flex justify-between text-lg font-extrabold"><dt>Total a pagar al recibir</dt><dd>{formatUSD(order.totalCents)}</dd></div>
        </dl>
      </div>

      <div className="card p-4 text-sm">
        <h2 className="font-extrabold">Entrega</h2>
        <p className="mt-1">{order.customerName}</p>
        <p>{order.address}, {order.city}, {order.provinceName}</p>
        <p className="text-ink-soft">Ref.: {order.reference}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa">Consultar por WhatsApp</a>}
        <Link href="/" className="btn btn-ghost">Seguir comprando</Link>
      </div>
    </div>
  );
}
