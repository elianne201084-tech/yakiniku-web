import Link from "next/link";
import { getCategoryTree, getHomeSections } from "@/modules/catalog";
import { ProductGrid, Section } from "@/components/ui";

export const revalidate = 300;

export default async function Home() {
  const [tree, h] = await Promise.all([getCategoryTree(), getHomeSections()]);
  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white sm:p-10">
        <p className="text-sm font-bold uppercase tracking-widest text-sun-400">Hecho en Ecuador</p>
        <h1 className="mt-2 max-w-xl text-3xl font-black leading-tight sm:text-5xl">Todo lo que necesitas, a tu puerta.</h1>
        <p className="mt-3 max-w-lg text-white/90">Compra sin crear cuenta, paga cuando recibes y sigue tu pedido por WhatsApp.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/buscar" className="btn bg-sun-500 text-ink hover:bg-sun-400">Ver todos los productos</Link>
          <Link href="/seguimiento" className="btn border border-white/40 text-white hover:bg-white/10">Seguir mi pedido</Link>
        </div>
      </section>

      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        {[["Pago contra entrega", "Pagas cuando recibes tu pedido"], ["Envío a todo el Ecuador", "Las 24 provincias, con courier"], ["Seguimiento por WhatsApp", "Te avisamos en cada paso"]].map(([t, d]) => (
          <li key={t} className="card p-3"><b>{t}</b><br /><span className="text-ink-soft">{d}</span></li>
        ))}
      </ul>

      <Section title="Categorías">
        <ul className="flex gap-2 overflow-x-auto pb-2">
          {tree.map((c) => <li key={c.id} className="shrink-0"><Link href={`/c/${c.path}`} className="btn btn-ghost whitespace-nowrap text-sm">{c.name}</Link></li>)}
        </ul>
      </Section>

      {h.deals.length > 0 && <Section title="Ofertas del día" href="/buscar?orden=precio_asc"><ProductGrid items={h.deals} /></Section>}
      <Section title="Los más vendidos" href="/buscar?orden=vendidos"><ProductGrid items={h.bestSellers} /></Section>
      <Section title="Novedades" href="/buscar?orden=novedades"><ProductGrid items={h.newest} /></Section>
      {h.recommended.length > 0 && <Section title="Recomendados para ti" href="/buscar?orden=valoracion"><ProductGrid items={h.recommended} /></Section>}
    </>
  );
}
