import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelated } from "@/modules/catalog";
import { getSettings } from "@/lib/settings";
import { Gallery } from "@/components/gallery";
import { ProductBuy } from "@/components/product-buy";
import { ProductGrid, Section, Stars, leadTimeText } from "@/components/ui";
import { ViewContent } from "@/components/view-content";

type Props = { params: Promise<{ slug: string }> };
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProductBySlug((await params).slug);
  if (!data) return {};
  const { product: p } = data;
  return { title: p.title, description: p.description.slice(0, 155), alternates: { canonical: `/p/${p.slug}` } };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product: p, crumbs, sizeGuide } = data;
  const [related, settings] = await Promise.all([getRelated(p.id, p.categoryId), getSettings()]);
  const url = `${site()}/p/${p.slug}`;
  const attrs = Object.entries((p.attributes ?? {}) as Record<string, string>);
  const intl = p.supplier.origin === "INTERNACIONAL";
  const inStock = p.variants.some((v) => v.stock > 0);

  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.description,
    image: p.images.map((i) => (i.url.startsWith("http") ? i.url : `${site()}${i.url}`)), sku: p.variants[0]?.sku,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand.name } } : {}),
    ...(p.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
    offers: { "@type": "Offer", url, priceCurrency: "USD", price: (p.priceCents / 100).toFixed(2), availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <ViewContent productId={p.id} value={p.priceCents / 100} />
      <nav aria-label="Ruta" className="mb-3 text-sm text-ink-soft">
        <Link href="/" className="underline">Inicio</Link>
        {crumbs.map((c) => <span key={c.path}> / <Link href={`/c/${c.path}`} className="underline">{c.name}</Link></span>)}
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <Gallery images={p.images.map((i) => ({ url: i.url, alt: i.alt }))} title={p.title} />
        <div className="space-y-4">
          <div>
            {p.brand && <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{p.brand.name}</p>}
            <h1 className="text-2xl font-extrabold leading-tight">{p.title}</h1>
            <div className="mt-1"><Stars value={p.ratingAvg} count={p.ratingCount} /></div>
          </div>

          <ProductBuy productId={p.id} title={p.title} waNumber={settings.company.whatsapp} url={url} hasGuide={!!sizeGuide}
            variants={p.variants.map((v) => ({ id: v.id, options: v.options as Record<string, string>, priceCents: v.priceCents, compareAtCents: v.compareAtCents, stock: v.stock }))} />

          <ul className="card divide-y divide-line text-sm">
            <li className="p-3"><b>Entrega:</b> {leadTimeText(p.leadDaysMin, p.leadDaysMax)} de preparación, más el envío a tu provincia. Verás el costo exacto antes de confirmar.</li>
            {intl && <li className="p-3"><b>Importación:</b> este producto llega desde {p.supplier.country}. El plazo ya considera el trayecto internacional.</li>}
            <li className="p-3"><b>Pago:</b> contra entrega, sin adelantos.</li>
            <li className="p-3"><b>Origen de la marca:</b> {p.brandDeclaration === "ORIGINAL_AUTORIZADO" ? `Producto original ${p.brand ? `de ${p.brand.name}` : ""}, vendido por proveedor autorizado.` : "Producto genérico, sin marca registrada."}</li>
            <li className="p-3"><Link href="/politicas/devoluciones" className="underline">Devoluciones</Link> · <Link href="/politicas/garantia" className="underline">Garantía</Link></li>
          </ul>
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-lg font-extrabold">Descripción</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{p.description}</p>
          {attrs.length > 0 && (
            <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
              {attrs.map(([k, v]) => (<div key={k} className="contents"><dt className="font-semibold capitalize">{k.replace(/_/g, " ")}</dt><dd>{String(v)}</dd></div>))}
            </dl>
          )}
        </div>
        {sizeGuide && (
          <div id="guia-tallas" className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold">{sizeGuide.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-line"><th className="py-1 pr-3">Talla</th>{sizeGuide.columns.map((c) => <th key={c} className="py-1 pr-3">{c} ({sizeGuide.unit})</th>)}</tr></thead>
                <tbody>{(sizeGuide.rows as { label: string; values: string[] }[]).map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-0"><th className="py-1 pr-3">{r.label}</th>{r.values.map((v, i) => <td key={i} className="py-1 pr-3">{v}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {related.length > 0 && <Section title="Productos relacionados"><ProductGrid items={related} /></Section>}
    </>
  );
}
