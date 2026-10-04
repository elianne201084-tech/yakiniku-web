import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { daysUntil } from "@/modules/compliance";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireRole("ADMIN", "OPERATOR");
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const in60 = new Date(Date.now() + 60 * 86_400_000);
  const [newOrders, today, toDispatch, suspended, lowStock, failedMsgs, expiring] = await Promise.all([
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({ where: { status: { in: ["CONFIRMED", "SENT_TO_SUPPLIER"] } } }),
    prisma.product.count({ where: { status: "SUSPENDED" } }),
    prisma.variant.count({ where: { active: true, stock: { lte: 3 }, product: { status: "PUBLISHED" } } }),
    prisma.notification.count({ where: { status: "FAILED" } }),
    prisma.complianceDoc.findMany({ where: { expiresAt: { lte: in60 }, product: { status: "PUBLISHED" } }, include: { product: { select: { id: true, title: true } } }, orderBy: { expiresAt: "asc" }, take: 15 }),
  ]);
  const stat = (label: string, n: number, href: string, warn = false) => (
    <Link href={href} className={`card p-4 ${warn && n > 0 ? "border-brand-500" : ""}`}><p className="text-3xl font-black">{n}</p><p className="text-sm text-ink-soft">{label}</p></Link>
  );
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">Resumen</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stat("Pedidos nuevos por confirmar", newOrders, "/admin/pedidos?estado=NEW", true)}
        {stat("Pedidos de hoy", today, "/admin/pedidos")}
        {stat("Por enviar o despachar", toDispatch, "/admin/pedidos?estado=CONFIRMED")}
        {stat("Productos despublicados", suspended, "/admin/productos?estado=SUSPENDED", true)}
        {stat("Variantes con stock bajo (≤3)", lowStock, "/admin/productos")}
        {stat("Mensajes de WhatsApp fallidos", failedMsgs, "/admin/pedidos", true)}
      </div>
      <section className="card mt-6 p-4">
        <h2 className="text-lg font-extrabold">Documentos por vencer o vencidos</h2>
        {expiring.length === 0 ? <p className="mt-2 text-sm text-ink-soft">Ningún documento vence en los próximos 60 días.</p> : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {expiring.map((d) => {
              const days = daysUntil(d.expiresAt);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/productos/${d.product.id}`} className="underline">{d.product.title}</Link>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${days < 0 ? "bg-brand-600 text-white" : days <= 7 ? "bg-brand-100 text-brand-700" : "bg-sun-400/40"}`}>
                    {days < 0 ? `Vencido hace ${-days} d` : `Vence en ${days} d`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-soft">Los productos con documento vencido se despublican automáticamente cada día.</p>
      </section>
    </>
  );
}
