import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatUSD } from "@/lib/money";
import { displayPhone } from "@/lib/validation";
import { NEXT_STATUS, STATUS_LABEL } from "@/modules/orders";
import { orderStatusAction, retryNotificationsAction } from "../../../actions";
import { Flash, type PanelSP } from "../../../ui";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<PanelSP> }) {
  await requireRole("ADMIN", "OPERATOR");
  const { id } = await params;
  const sp = await searchParams;
  const o = await prisma.order.findUnique({
    where: { id },
    include: { subOrders: { include: { supplier: true, items: true } }, notifications: { orderBy: { createdAt: "desc" } }, payments: true },
  });
  if (!o) notFound();
  const margin = o.subOrders.flatMap((s) => s.items).reduce((m, i) => m + (i.unitPrice - i.unitCost) * i.qty, 0);
  const next = NEXT_STATUS[o.status];
  const hasFailed = o.notifications.some((n) => n.status !== "SENT");

  return (
    <>
      <p className="text-sm"><Link href="/admin/pedidos" className="underline">← Pedidos</Link></p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{o.number}</h1>
        <span className="rounded bg-ink px-2 py-1 text-xs font-bold text-white">{STATUS_LABEL[o.status]}</span>
        <span className="text-sm text-ink-soft">Canal: {o.channel}</span>
      </div>
      <div className="mt-4"><Flash {...sp} /></div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-extrabold">Cliente y entrega</h2>
          <p><b>{o.customerName}</b> · Cédula/RUC {o.idNumber}</p>
          <p>Celular: {displayPhone(o.phone)} {o.email && `· ${o.email}`}</p>
          <p className="mt-2">{o.address}</p><p>{o.city}, {o.provinceName}</p><p className="text-ink-soft">Ref.: {o.reference}</p>
          {o.notes && <p className="mt-2 rounded bg-paper p-2">Nota: {o.notes}</p>}
          <p className="mt-2 text-xs text-ink-soft">Consentimiento de privacidad: {o.privacyConsentAt.toLocaleString("es-EC")} (versión {o.consentVersion})</p>
        </section>

        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-extrabold">Cambiar estado</h2>
          {next.length === 0 ? <p className="text-ink-soft">Este pedido ya está en un estado final.</p> : (
            <div className="space-y-3">
              {next.map((to) => (
                <form key={to} action={orderStatusAction} className="space-y-2">
                  <input type="hidden" name="orderId" value={o.id} /><input type="hidden" name="to" value={to} />
                  {to === "DISPATCHED" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input name="carrier" placeholder="Empresa de courier" required className="field" aria-label="Empresa de courier" />
                      <input name="trackingCode" placeholder="Número de guía" required className="field" aria-label="Número de guía" />
                    </div>
                  )}
                  <button className={`btn ${to === "CANCELLED" || to === "RETURNED" ? "btn-ghost" : "btn-primary"} w-full`}>Pasar a: {STATUS_LABEL[to]}</button>
                </form>
              ))}
              <p className="text-xs text-ink-soft">Cada cambio avisa al cliente por WhatsApp. Cancelar devuelve el stock.</p>
            </div>
          )}
        </section>
      </div>

      {o.subOrders.map((s) => (
        <section key={s.id} className="card mt-4 p-4 text-sm">
          <h2 className="font-extrabold">Proveedor: {s.supplier.tradeName} <span className="ml-1 rounded bg-paper px-2 py-0.5 text-xs">{s.supplier.origin === "INTERNACIONAL" ? `Importación · ${s.supplier.country}` : "Nacional"}</span></h2>
          <table className="mt-2 w-full text-left"><tbody>
            {s.items.map((i) => (<tr key={i.id} className="border-b border-line last:border-0"><td className="py-2">{i.qty}× {i.titleSnapshot} {i.optionsText && <span className="text-ink-soft">({i.optionsText})</span>}</td><td className="py-2 text-right">{formatUSD(i.unitPrice * i.qty)}</td></tr>))}
          </tbody></table>
          <p className="mt-2 text-xs text-ink-soft">Envío de este sub-pedido: {formatUSD(s.shippingCents)}{s.trackingCode && ` · ${s.carrier} · guía ${s.trackingCode}`}</p>
        </section>
      ))}

      <section className="card mt-4 p-4 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatUSD(o.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{formatUSD(o.shippingCents)}</dd></div>
          <div className="flex justify-between text-base font-extrabold"><dt>Total (contra entrega)</dt><dd>{formatUSD(o.totalCents)}</dd></div>
          <div className="flex justify-between text-ink-soft"><dt>IVA incluido</dt><dd>{formatUSD(o.taxCents)}</dd></div>
          <div className="flex justify-between text-ink-soft"><dt>Margen de productos (sin envío)</dt><dd>{formatUSD(margin)}</dd></div>
          <div className="flex justify-between text-ink-soft"><dt>Pago</dt><dd>{o.payments.map((p) => `${p.method} · ${p.status}`).join(", ")}</dd></div>
        </dl>
      </section>

      <section className="card mt-4 p-4 text-sm">
        <div className="flex items-center justify-between"><h2 className="font-extrabold">Mensajes de WhatsApp</h2>
          {hasFailed && <form action={retryNotificationsAction}><input type="hidden" name="orderId" value={o.id} /><button className="btn btn-ghost !min-h-9 text-xs">Reintentar envío</button></form>}</div>
        <ul className="mt-2 divide-y divide-line">
          {o.notifications.map((n) => (
            <li key={n.id} className="py-2">
              <span className={`mr-2 rounded px-2 py-0.5 text-xs font-bold ${n.status === "SENT" ? "bg-green-100 text-green-800" : n.status === "FAILED" ? "bg-brand-100 text-brand-700" : "bg-sun-400/40"}`}>{n.status === "SENT" ? "Enviado" : n.status === "FAILED" ? "Falló" : "Pendiente"}</span>
              <code className="text-xs">{n.template}</code> <span className="text-xs text-ink-soft">{n.createdAt.toLocaleString("es-EC")}</span>
              {n.lastError && <p className="mt-1 text-xs text-brand-700">{n.lastError}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
