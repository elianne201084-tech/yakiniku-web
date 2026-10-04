import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { DOC_TYPE_LABEL, type DocTypeKey } from "@/modules/compliance";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "../../actions";
import { Flash, type PanelSP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function Categories({ searchParams }: { searchParams: Promise<PanelSP> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const all = await prisma.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true, children: true } } } });
  const kids = (id: string | null) => all.filter((c) => c.parentId === id);

  const Row = ({ c }: { c: (typeof all)[number] }) => (
    <li className="mt-2">
      <details className="card" open={false}>
        <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
          <b>{c.name}</b>
          <span className="text-xs text-ink-soft">nivel {c.level} · {c._count.products} producto(s)</span>
          {!c.isVisible && <span className="rounded bg-ink px-2 py-0.5 text-xs font-bold text-white">Oculta</span>}
          {c.isRegulated && <span className="rounded bg-sun-400/50 px-2 py-0.5 text-xs font-bold">Regulada</span>}
        </summary>
        <div className="space-y-3 border-t border-line p-3">
          <form action={updateCategoryAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={c.id} />
            <div><label className="label" htmlFor={`n-${c.id}`}>Nombre</label><input id={`n-${c.id}`} name="name" defaultValue={c.name} className="field" required /></div>
            <div><label className="label" htmlFor={`p-${c.id}`}>Orden</label><input id={`p-${c.id}`} name="position" type="number" defaultValue={c.position} className="field" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVisible" defaultChecked={c.isVisible} className="size-5" />Visible en la tienda</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRegulated" defaultChecked={c.isRegulated} className="size-5" />Regulada (exige documento de respaldo)</label>
            <fieldset className="sm:col-span-2"><legend className="label">Documentos aceptados (si está regulada)</legend>
              <div className="flex flex-wrap gap-3 text-sm">{(Object.keys(DOC_TYPE_LABEL) as DocTypeKey[]).map((t) => (
                <label key={t} className="flex items-center gap-2"><input type="checkbox" name="docTypes" value={t} defaultChecked={c.acceptedDocTypes.includes(t)} className="size-4" />{DOC_TYPE_LABEL[t]}</label>
              ))}</div></fieldset>
            <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary">Guardar</button></div>
          </form>
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
            {c.level < 3 && (
              <form action={createCategoryAction} className="flex flex-1 items-end gap-2">
                <input type="hidden" name="parentId" value={c.id} />
                <div className="flex-1"><label className="label" htmlFor={`s-${c.id}`}>Nueva {c.level === 1 ? "subcategoría" : "tipo"} dentro de “{c.name}”</label><input id={`s-${c.id}`} name="name" className="field" required /></div>
                <button className="btn btn-dark">Agregar</button>
              </form>
            )}
            {c._count.children === 0 && c._count.products === 0 && (
              <form action={deleteCategoryAction}><input type="hidden" name="id" value={c.id} /><button className="btn btn-ghost">Eliminar</button></form>
            )}
          </div>
        </div>
      </details>
      {kids(c.id).length > 0 && <ul className="ml-4 border-l-2 border-line pl-3">{kids(c.id).map((k) => <Row key={k.id} c={k} />)}</ul>}
    </li>
  );

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Categorías</h1>
      <p className="mb-4 text-sm text-ink-soft">Tres niveles: categoría, subcategoría y tipo. Ocultar una categoría la quita de la tienda sin borrar sus productos.</p>
      <Flash {...sp} />
      <form action={createCategoryAction} className="card mb-4 flex items-end gap-2 p-3">
        <div className="flex-1"><label className="label" htmlFor="newtop">Nueva categoría principal</label><input id="newtop" name="name" className="field" required /></div>
        <button className="btn btn-primary">Crear</button>
      </form>
      <ul>{kids(null).map((c) => <Row key={c.id} c={c} />)}</ul>
    </>
  );
}
