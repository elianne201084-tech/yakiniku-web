import Link from "next/link";
import Image from "next/image";
import { discountPercent, formatUSD } from "@/lib/money";
import type { ProductCard as Card } from "@/modules/catalog";

/** Las imágenes de ejemplo son SVG locales: no pasan por el optimizador. Las reales sí (AVIF/WebP, carga diferida). */
export function ProductImage({ src, alt, sizes, priority }: { src: string | null; alt: string; sizes: string; priority?: boolean }) {
  const url = src ?? "/placeholder/sin-imagen.svg";
  return (
    <Image src={url} alt={alt} fill sizes={sizes} priority={priority} unoptimized={url.startsWith("/placeholder")} className="object-cover" />
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  if (!count) return <span className="text-xs text-ink-soft">Sin reseñas aún</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-soft" aria-label={`Valoración ${value} de 5, ${count} reseñas`}>
      <span aria-hidden className="text-sun-500">{"★".repeat(Math.round(value))}<span className="text-line">{"★".repeat(5 - Math.round(value))}</span></span>
      <span>{value.toFixed(1)} ({count})</span>
    </span>
  );
}

export function Price({ cents, compareAt, size = "md" }: { cents: number; compareAt?: number | null; size?: "md" | "lg" }) {
  const off = discountPercent(cents, compareAt);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-extrabold ${size === "lg" ? "text-3xl" : "text-lg"}`}>{formatUSD(cents)}</span>
      {off > 0 && (
        <>
          <span className="text-sm text-ink-soft line-through">{formatUSD(compareAt!)}</span>
          <span className="rounded bg-brand-50 px-1.5 text-xs font-bold text-brand-700">-{off}%</span>
        </>
      )}
    </div>
  );
}

export function leadTimeText(min: number, max: number) {
  return min === max ? `${min} días hábiles` : `${min} a ${max} días hábiles`;
}

export function ProductCard({ p, priority }: { p: Card; priority?: boolean }) {
  const soldOut = p.totalStock <= 0;
  return (
    <Link href={`/p/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-square bg-paper">
        <ProductImage src={p.image} alt={p.title} sizes="(min-width:1024px) 20vw, (min-width:640px) 33vw, 50vw" priority={priority} />
        {soldOut && <span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-bold text-white">Agotado</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {p.brand && <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{p.brand}</span>}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{p.title}</h3>
        <Stars value={p.ratingAvg} count={p.ratingCount} />
        <div className="mt-auto pt-1"><Price cents={p.priceCents} compareAt={p.compareAtCents} /></div>
        <span className="text-[11px] text-ink-soft">Entrega en {leadTimeText(p.leadDaysMin, p.leadDaysMax)}</span>
      </div>
    </Link>
  );
}

export function ProductGrid({ items }: { items: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav aria-label="Paginación" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link className="btn btn-ghost" href={hrefFor(page - 1)} rel="prev">← Anterior</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden>…</span>}
          <Link href={hrefFor(n)} aria-current={n === page ? "page" : undefined}
            className={`btn ${n === page ? "btn-dark" : "btn-ghost"} !min-w-11 !px-3`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link className="btn btn-ghost" href={hrefFor(page + 1)} rel="next">Siguiente →</Link>}
    </nav>
  );
}

export function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {href && <Link href={href} className="text-sm font-semibold text-brand-700 underline">Ver más</Link>}
      </div>
      {children}
    </section>
  );
}
