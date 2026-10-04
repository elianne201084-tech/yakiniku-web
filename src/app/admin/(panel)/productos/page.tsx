import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatUSD } from "@/lib/money";

export const dynamic = "force-dynamic";
const PER_PAGE = 30;
const STATUS: Record<string, string> = { DRAFT: "Borrador", PENDING_REVIEW: "En revisión", PUBLISHED: "Publicado", SUSPENDED: "Despublicado" };

export default async function Products({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; pagina?: string }> }) {
  await requireRole("ADMIN", "OPERATOR");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);
  const where: Prisma.ProductWhereInput = {
    ...(sp.estado && sp.estado in STATUS ? { status: sp.estado as keyof typeof STATUS as never } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (page - 1) * PER_PAGE, include: { supplier: { select: { tradeName: true } }, category: { select: { name: true } } } }),
    prisma.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/admin/productos?${new URLSearchParams({ ...(sp.estado ? { estado: sp.estado } : {}), ...(q ? { q } : {}), pagina: String(p) })}`;
  return (
    <>
      <div className="mb-3 flex items-center justify-between"><h1 className="text-2xl font-extrabold">Productos</h1><Link href="/admin/productos/nuevo" className="btn btn-primary">+ Nuevo producto</Link></div>
      <nav aria-label="Estados" className="mb-3 flex gap-1 overflow-x-auto">
        {[["", "Todos"], ...Object.entries(STATUS)].map(([s, l]) => (
          <Link key={s} href={`/admin/productos${s ? `?estado=${s}` : ""}`} className={`btn !min-h-10 whitespace-nowrap text-sm ${(sp.estado ?? "") === s ? "btn-dark" : "btn-ghost"}`}>{l}</Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2">
        {sp.estado && <input type="hidden" name="estado" value={sp.estado} />}
        <input name="q" defaultValue={q} placeholder="Buscar por título" className="field" aria-label="Buscar producto" /><button className="btn btn-dark">Buscar</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-ink-soft"><tr><th className="p-3">Producto</th><th className="p-3">Proveedor</th><th className="p-3">Categoría</th><th className="p-3">Precio</th><th className="p-3">Stock</th><th className="p-3">Estado</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="max-w-xs p-3"><Link href={`/admin/productos/${p.id}`} className="line-clamp-2 underline">{p.title}</Link></td>
                <td className="p-3">{p.supplier.tradeName}</td><td className="p-3">{p.category.name}</td>
                <td className="p-3">{formatUSD(p.priceCents)}</td><td className="p-3">{p.totalStock}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-bold ${p.status === "PUBLISHED" ? "bg-green-100 text-green-800" : p.status === "SUSPENDED" ? "bg-brand-100 text-brand-700" : "bg-paper"}`}>{STATUS[p.status]}</span></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Sin productos.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center justify-between text-sm text-ink-soft"><span>{total.toLocaleString("es-EC")} producto(s) · página {page} de {pages}</span>
        <span className="flex gap-2">{page > 1 && <Link className="btn btn-ghost !min-h-10" href={href(page - 1)}>← Anterior</Link>}{page < pages && <Link className="btn btn-ghost !min-h-10" href={href(page + 1)}>Siguiente →</Link>}</span></p>
    </>
  );
}
