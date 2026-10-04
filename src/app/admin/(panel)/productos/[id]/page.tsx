import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatUSD } from "@/lib/money";
import { DOC_TYPE_LABEL, checkPublishable, daysUntil, docStatus, type DocTypeKey } from "@/modules/compliance";
import { loadPublishInput } from "@/modules/products";
import { addDocAction, deleteDocAction, publishAction, saveImagesAction, saveProductAction, saveVariantAction, suspendAction } from "../../../actions";
import { Flash, type PanelSP } from "../../../ui";

export const dynamic = "force-dynamic";
const STATUS: Record<string, string> = { DRAFT: "Borrador", PENDING_REVIEW: "En revisión", PUBLISHED: "Publicado", SUSPENDED: "Despublicado" };
const toUSD = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));
const optText = (o: unknown) => Object.entries(o as Record<string, string>).map(([k, v]) => `${k}=${v}`).join("; ");

export default async function ProductEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<PanelSP> }) {
  await requireRole("ADMIN", "OPERATOR");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nuevo";

  const [suppliers, brands, cats, product] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { tradeName: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
    isNew ? null : prisma.product.findUnique({ where: { id }, include: { variants: { orderBy: { sku: "asc" } }, images: { orderBy: { position: "asc" } }, docs: { orderBy: { expiresAt: "asc" } }, brand: true } }),
  ]);
  if (!isNew && !product) notFound();

  const label = (c: (typeof cats)[number]): string => { const p = cats.find((x) => x.id === c.parentId); return p ? `${label(p)} › ${c.name}` : c.name; };
  const catOptions = cats.map((c) => ({ id: c.id, text: label(c) })).sort((a, b) => a.text.localeCompare(b.text, "es"));
  const input = product ? await loadPublishInput(product.id) : null;
  const blockers = input ? checkPublishable(input) : [];

  return (
    <>
      <p className="text-sm"><Link href="/admin/productos" className="underline">← Productos</Link></p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{isNew ? "Nuevo producto" : product!.title}</h1>
        {product && <span className="rounded bg-ink px-2 py-1 text-xs font-bold text-white">{STATUS[product.status]}</span>}
        {product?.status === "PUBLISHED" && <Link href={`/p/${product.slug}`} className="text-sm underline" target="_blank">Ver en la tienda</Link>}
      </div>
      <div className="mt-4"><Flash {...sp} /></div>

      <form action={saveProductAction} className="card grid gap-4 p-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={product?.id ?? ""} />
        <div className="sm:col-span-2"><label className="label" htmlFor="title">Título</label><input id="title" name="title" defaultValue={product?.title} required minLength={5} className="field" /></div>
        <div><label className="label" htmlFor="supplierId">Proveedor</label>
          <select id="supplierId" name="supplierId" defaultValue={product?.supplierId ?? ""} required className="field"><option value="">Elige…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.tradeName} ({s.origin === "NACIONAL" ? "nacional" : s.country})</option>)}</select></div>
        <div><label className="label" htmlFor="categoryId">Categoría</label>
          <select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""} required className="field"><option value="">Elige…</option>{catOptions.map((c) => <option key={c.id} value={c.id}>{c.text}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="description">Descripción</label><textarea id="description" name="description" rows={4} defaultValue={product?.description} className="field" /></div>
        <div><label className="label" htmlFor="leadDaysMin">Plazo de entrega: mínimo (días)</label><input id="leadDaysMin" name="leadDaysMin" type="number" min={0} defaultValue={product?.leadDaysMin ?? 2} className="field" /></div>
        <div><label className="label" htmlFor="leadDaysMax">Plazo de entrega: máximo (días)</label><input id="leadDaysMax" name="leadDaysMax" type="number" min={0} defaultValue={product?.leadDaysMax ?? 5} className="field" /></div>
        <div><label className="label" htmlFor="weightGrams">Peso por unidad (gramos)</label><input id="weightGrams" name="weightGrams" type="number" min={1} defaultValue={product?.weightGrams ?? 500} className="field" /></div>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="isRecommended" defaultChecked={product?.isRecommended} className="size-5" />Mostrar en “Recomendados”</label>

        <fieldset className="rounded-xl border border-line bg-paper p-3 sm:col-span-2">
          <legend className="px-1 text-sm font-bold">Declaración de marca del proveedor</legend>
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2"><input type="radio" name="brandDeclaration" value="GENERICO_SIN_MARCA" defaultChecked={!product || product.brandDeclaration === "GENERICO_SIN_MARCA"} className="mt-1 size-4" />Genérico, sin marca registrada</label>
            <label className="flex items-start gap-2"><input type="radio" name="brandDeclaration" value="ORIGINAL_AUTORIZADO" defaultChecked={product?.brandDeclaration === "ORIGINAL_AUTORIZADO"} className="mt-1 size-4" />Original de una marca, y el proveedor está autorizado a venderlo</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="brandId" defaultValue={product?.brandId ?? ""} className="field" aria-label="Marca existente"><option value="">Marca existente…</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.blocked ? " (bloqueada)" : ""}</option>)}</select>
              <input name="newBrand" placeholder="…o escribe una marca nueva" className="field" aria-label="Marca nueva" />
            </div>
            <label className="flex items-start gap-2"><input type="checkbox" name="declare" defaultChecked={!!product?.declaredAt} className="mt-1 size-5" /><span>El proveedor declara que este producto es original o genérico sin marca, y que <b>no es una imitación</b> de una marca registrada. Está prohibido publicar imitaciones.</span></label>
          </div>
        </fieldset>
        <div className="sm:col-span-2"><button className="btn btn-primary">{isNew ? "Crear borrador" : "Guardar datos"}</button></div>
      </form>

      {product && input && (
        <>
          <section className="card mt-4 p-4">
            <h2 className="text-lg font-extrabold">Publicación</h2>
            {input.regulation.regulated && <p className="mt-1 rounded-lg bg-sun-400/30 p-2 text-sm">Categoría regulada. Requiere: <b>{input.regulation.accepted.map((t) => DOC_TYPE_LABEL[t]).join(" / ") || "cualquier documento de respaldo"}</b>, aprobado y vigente.</p>}
            {blockers.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brand-700">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : <p className="mt-2 text-sm font-semibold text-green-800">Cumple todos los requisitos para publicarse.</p>}
            <div className="mt-3 flex gap-2">
              {product.status !== "PUBLISHED" && <form action={publishAction}><input type="hidden" name="id" value={product.id} /><button className="btn btn-primary" disabled={blockers.length > 0}>Publicar</button></form>}
              {product.status === "PUBLISHED" && <form action={suspendAction}><input type="hidden" name="id" value={product.id} /><button className="btn btn-ghost">Despublicar</button></form>}
            </div>
          </section>

          <section className="card mt-4 p-4">
            <h2 className="text-lg font-extrabold">Variantes, precios y stock</h2>
            <p className="mb-2 text-xs text-ink-soft">Opciones con el formato <code>talla=M; color=Negro</code>. Los precios incluyen IVA. “Antes” es opcional y muestra el descuento.</p>
            <div className="space-y-3">
              {[...product.variants, null].map((v) => (
                <form key={v?.id ?? "new"} action={saveVariantAction} className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-6 ${v ? "border-line" : "border-dashed border-ink-soft"}`}>
                  <input type="hidden" name="productId" value={product.id} /><input type="hidden" name="id" value={v?.id ?? ""} />
                  <div className="sm:col-span-2"><label className="label">Opciones</label><input name="options" defaultValue={v ? optText(v.options) : ""} className="field" placeholder="talla=M; color=Negro" /></div>
                  <div><label className="label">Costo</label><input name="cost" defaultValue={toUSD(v?.costCents ?? null)} inputMode="decimal" className="field" required /></div>
                  <div><label className="label">Precio</label><input name="price" defaultValue={toUSD(v?.priceCents ?? null)} inputMode="decimal" className="field" required /></div>
                  <div><label className="label">Antes</label><input name="compareAt" defaultValue={toUSD(v?.compareAtCents ?? null)} inputMode="decimal" className="field" /></div>
                  <div><label className="label">Stock</label><input name="stock" type="number" min={0} defaultValue={v?.stock ?? 0} className="field" /></div>
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
                    {v ? (<><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={v.active} className="size-5" />Activa</label>
                      <span className="text-xs text-ink-soft">SKU {v.sku} · margen {formatUSD(v.priceCents - v.costCents)} ({Math.round(((v.priceCents - v.costCents) / v.priceCents) * 100)}%)</span></>)
                      : <input name="sku" placeholder="SKU (opcional)" className="field !w-48" aria-label="SKU" />}
                    <button className={`btn ${v ? "btn-dark" : "btn-primary"} ml-auto !min-h-10`}>{v ? "Guardar" : "Agregar variante"}</button>
                  </div>
                </form>
              ))}
            </div>
          </section>

          <section className="card mt-4 p-4">
            <h2 className="text-lg font-extrabold">Imágenes</h2>
            <form action={saveImagesAction} className="mt-2 space-y-2">
              <input type="hidden" name="productId" value={product.id} />
              <label className="label" htmlFor="urls">Una URL https:// por línea (la primera es la principal)</label>
              <textarea id="urls" name="urls" rows={4} defaultValue={product.images.map((i) => i.url).join("\n")} className="field" />
              <button className="btn btn-dark">Guardar imágenes</button>
            </form>
          </section>

          <section className="card mt-4 p-4">
            <h2 className="text-lg font-extrabold">Documentos de respaldo</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {product.docs.map((d) => {
                const st = docStatus(d); const days = daysUntil(d.expiresAt);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                    <b>{DOC_TYPE_LABEL[d.type as DocTypeKey]}</b> <span>N.º {d.number}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${st === "EXPIRED" ? "bg-brand-600 text-white" : st === "EXPIRING" ? "bg-sun-400/50" : "bg-green-100 text-green-800"}`}>{st === "EXPIRED" ? "Vencido" : st === "EXPIRING" ? `Vence en ${days} d` : `Vigente hasta ${d.expiresAt.toLocaleDateString("es-EC")}`}</span>
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">Ver archivo</a>
                    <form action={deleteDocAction} className="ml-auto"><input type="hidden" name="id" value={d.id} /><button className="text-brand-700 underline">Eliminar</button></form>
                  </li>
                );
              })}
              {product.docs.length === 0 && <li className="py-2 text-ink-soft">Sin documentos.</li>}
            </ul>
            <form action={addDocAction} className="mt-3 grid gap-2 rounded-xl border border-dashed border-ink-soft p-3 sm:grid-cols-3">
              <input type="hidden" name="productId" value={product.id} />
              <div><label className="label">Tipo</label><select name="type" required className="field"><option value="">Elige…</option>{(Object.keys(DOC_TYPE_LABEL) as DocTypeKey[]).map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}</select></div>
              <div><label className="label">Número</label><input name="number" required className="field" /></div>
              <div><label className="label">Emitido por</label><input name="issuer" className="field" placeholder="ARCSA, INEN…" /></div>
              <div><label className="label">Fecha de emisión</label><input name="issuedAt" type="date" className="field" /></div>
              <div><label className="label">Vigente hasta</label><input name="expiresAt" type="date" required className="field" /></div>
              <div><label className="label">URL del archivo (https://)</label><input name="fileUrl" type="url" required className="field" /></div>
              <div className="sm:col-span-3"><button className="btn btn-dark">Agregar documento</button></div>
            </form>
          </section>
        </>
      )}
    </>
  );
}
