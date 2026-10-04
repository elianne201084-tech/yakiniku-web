import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatUSD } from "@/lib/money";
import { displayPhone } from "@/lib/validation";
import { STATUS_LABEL } from "@/modules/orders";
import type { OrderStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
const PER_PAGE = 30;

export default async function Orders({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; pagina?: string }> }) {
  await requireRole("ADMIN", "OPERATOR");
  const sp = await searchParams;
  const estado = sp.estado && sp.estado in STATUS_LABEL ? (sp.estado as OrderStatus) : undefined;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(estado ? { status: estado } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || "x" } }] } : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (page - 1) * PER_PAGE, include: { subOrders: { select: { id: true } } } }),
    prisma.order.count({ where }),
  ]);
  const tab = (s: OrderStatus | "") => `/admin/pedidos?${new URLSearchParams({ ...(s ? { estado: s } : {}), ...(q ? { q } : {}) })}`;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <>
      <h1 className="mb-3 text-2xl font-extrabold">Pedidos</h1>
      <nav aria-label="Estados" className="mb-3 flex gap-1 overflow-x-auto">
        {([["", "Todos"], ...Object.entries(STATUS_LABEL)] as [string, string][]).map(([s, label]) => (
          <Link key={s} href={tab(s as OrderStatus | "")} className={`btn !min-h-10 whitespace-nowrap text-sm ${(estado ?? "") === s ? "btn-dark" : "btn-ghost"}`}>{label}</Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input name="q" defaultValue={q} placeholder="Número, nombre o celular" className="field" aria-label="Buscar pedido" />
        <button className="btn btn-dark">Buscar</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-ink-soft"><tr><th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Destino</th><th className="p-3">Total</th><th className="p-3">Estado</th><th className="p-3">Fecha</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="p-3 font-bold"><Link href={`/admin/pedidos/${o.id}`} className="underline">{o.number}</Link>{o.subOrders.length > 1 && <span className="ml-1 text-xs font-normal text-ink-soft">({o.subOrders.length} proveedores)</span>}</td>
                <td className="p-3">{o.customerName}<br /><span className="text-xs text-ink-soft">{displayPhone(o.phone)}</span></td>
                <td className="p-3">{o.city}, {o.provinceName}</td>
                <td className="p-3 font-semibold">{formatUSD(o.totalCents)}</td>
                <td className="p-3"><span className="rounded bg-paper px-2 py-0.5 text-xs font-bold">{STATUS_LABEL[o.status]}</span></td>
                <td className="p-3 text-xs text-ink-soft">{o.createdAt.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">No hay pedidos con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center justify-between text-sm text-ink-soft">
        <span>{total} pedido(s) · página {page} de {pages}</span>
        <span className="flex gap-2">
          {page > 1 && <Link className="btn btn-ghost !min-h-10" href={`${tab(estado ?? "")}&pagina=${page - 1}`}>← Anterior</Link>}
          {page < pages && <Link className="btn btn-ghost !min-h-10" href={`${tab(estado ?? "")}&pagina=${page + 1}`}>Siguiente →</Link>}
        </span>
      </p>
    </>
  );
}
