"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Suggestions = { products: { title: string; slug: string }[]; categories: { name: string; path: string }[] };

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions | null>(null);
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setData(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (r.ok) setData(await r.json());
      } catch { /* cancelado o sin red */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const has = data && (data.products.length > 0 || data.categories.length > 0);
  return (
    <form ref={box} role="search" className="relative w-full" onSubmit={(e) => { e.preventDefault(); setOpen(false); if (q.trim()) router.push(`/buscar?q=${encodeURIComponent(q.trim())}`); }}>
      <label htmlFor="q" className="sr-only">Buscar productos</label>
      <input id="q" name="q" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        autoComplete="off" enterKeyHint="search" placeholder="Buscar productos, marcas y categorías" className="field !rounded-full pr-12" />
      <button type="submit" aria-label="Buscar" className="absolute right-1 top-1 grid size-10 place-items-center rounded-full bg-brand-600 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      {open && has && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          {data!.categories.map((c) => (
            <Link key={c.path} href={`/c/${c.path}`} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-paper">
              <span className="text-ink-soft">En categoría:</span> <b>{c.name}</b>
            </Link>
          ))}
          {data!.products.map((p) => (
            <Link key={p.slug} href={`/p/${p.slug}`} onClick={() => setOpen(false)} className="block truncate px-4 py-3 text-sm hover:bg-paper">{p.title}</Link>
          ))}
        </div>
      )}
    </form>
  );
}
