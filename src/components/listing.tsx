import Link from "next/link";
import { PAGE_SIZE, SORT_LABEL, listProducts, getFacets, type ListParams, type SortKey, type Facets } from "@/modules/catalog";
import { Pagination, ProductGrid } from "./ui";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean).slice(0, 20);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function usdToCents(v: string): number | undefined {
  const n = Number(v.replace(",", "."));
  return v && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

export function parseListParams(sp: SP, categoryPath?: string): ListParams {
  const sort = one(sp.orden) as SortKey;
  const page = Number(one(sp.pagina));
  return {
    q: one(sp.q).slice(0, 80) || undefined,
    categoryPath,
    minPrice: usdToCents(one(sp.min)),
    maxPrice: usdToCents(one(sp.max)),
    sizes: arr(sp.talla),
    colors: arr(sp.color),
    brands: arr(sp.marca),
    minRating: Number(one(sp.valoracion)) || undefined,
    maxLeadDays: Number(one(sp.entrega)) || undefined,
    sort: sort in SORT_LABEL ? sort : "relevancia",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function FiltersForm({ sp, facets }: { sp: SP; facets: Facets }) {
  const sel = (k: string) => new Set(arr(sp[k]));
  const sizes = sel("talla"), colors = sel("color"), brands = sel("marca");
  return (
    <form method="get" className="space-y-4 text-sm">
      {one(sp.q) && <input type="hidden" name="q" value={one(sp.q)} />}
      <div>
        <label className="label" htmlFor="orden">Ordenar por</label>
        <select id="orden" name="orden" defaultValue={one(sp.orden) || "relevancia"} className="field">
          {Object.entries(SORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="label">Precio (USD)</legend>
        <div className="flex items-center gap-2">
          <input name="min" inputMode="decimal" placeholder="Mín." defaultValue={one(sp.min)} className="field" aria-label="Precio mínimo" />
          <span>–</span>
          <input name="max" inputMode="decimal" placeholder="Máx." defaultValue={one(sp.max)} className="field" aria-label="Precio máximo" />
        </div>
      </fieldset>
      {facets.sizes.length > 0 && (
        <fieldset><legend className="label">Talla</legend>
          <div className="flex flex-wrap gap-2">{facets.sizes.map((s) => (
            <label key={s} className="cursor-pointer"><input type="checkbox" name="talla" value={s} defaultChecked={sizes.has(s)} className="peer sr-only" />
              <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-line bg-white px-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline">{s}</span></label>
          ))}</div></fieldset>
      )}
      {facets.colors.length > 0 && (
        <fieldset><legend className="label">Color</legend>
          <div className="flex flex-wrap gap-2">{facets.colors.map((c) => (
            <label key={c} className="cursor-pointer"><input type="checkbox" name="color" value={c} defaultChecked={colors.has(c)} className="peer sr-only" />
              <span className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-3 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline">{c}</span></label>
          ))}</div></fieldset>
      )}
      {facets.brands.length > 0 && (
        <fieldset><legend className="label">Marca</legend>
          <div className="space-y-1">{facets.brands.map((b) => (
            <label key={b.id} className="flex min-h-9 items-center gap-2"><input type="checkbox" name="marca" value={b.id} defaultChecked={brands.has(b.id)} className="size-4" />{b.name}</label>
          ))}</div></fieldset>
      )}
      <div>
        <label className="label" htmlFor="valoracion">Valoración</label>
        <select id="valoracion" name="valoracion" defaultValue={one(sp.valoracion)} className="field">
          <option value="">Todas</option><option value="4">4 estrellas o más</option><option value="3">3 estrellas o más</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="entrega">Plazo de entrega</label>
        <select id="entrega" name="entrega" defaultValue={one(sp.entrega)} className="field">
          <option value="">Cualquiera</option><option value="4">Hasta 4 días</option><option value="7">Hasta 7 días</option>
          <option value="15">Hasta 15 días</option><option value="30">Hasta 30 días (importación)</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1">Aplicar</button>
        <Link href="?" className="btn btn-ghost">Limpiar</Link>
      </div>
    </form>
  );
}

/** Listado con filtros, orden y paginación. Lo usan las categorías y la búsqueda. */
export async function Listing({ sp, categoryPath, basePath }: { sp: SP; categoryPath?: string; basePath: string }) {
  const params = parseListParams(sp, categoryPath);
  const [res, facets] = await Promise.all([listProducts(params), getFacets({ q: params.q, categoryPath })]);

  const hrefFor = (page: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v ? [v] : []) if (k !== "pagina") u.append(k, x);
    if (page > 1) u.set("pagina", String(page));
    const qs = u.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
      <details className="card mb-4 p-3 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">Filtros y orden</summary>
        <div className="pt-3"><FiltersForm sp={sp} facets={facets} /></div>
      </details>
      <aside className="card sticky top-32 hidden h-fit p-4 lg:block"><FiltersForm sp={sp} facets={facets} /></aside>
      <div>
        <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
          {res.total === 0 ? "Sin resultados" : `${res.total.toLocaleString("es-EC")} producto${res.total === 1 ? "" : "s"}`}
          {res.pages > 1 && ` · página ${res.page} de ${res.pages}`}
        </p>
        {res.items.length > 0 ? <ProductGrid items={res.items} /> : (
          <div className="card p-8 text-center">
            <p className="text-lg font-bold">No encontramos lo que buscas</p>
            <p className="mt-1 text-sm text-ink-soft">Revisa la ortografía, quita algún filtro o explora las categorías.</p>
          </div>
        )}
        <Pagination page={res.page} pages={res.pages} hrefFor={hrefFor} />
        <p className="sr-only">{PAGE_SIZE} productos por página</p>
      </div>
    </div>
  );
}
