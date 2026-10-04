"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/store-state";
import { ProductImage, Price } from "@/components/ui";
import { formatUSD } from "@/lib/money";
import { getCartLines, type CartLineView } from "../actions";

export function CartView() {
  const { items, ready, setQty, remove } = useStore();
  const [lines, setLines] = useState<CartLineView[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) { setLines([]); return; }
    let live = true;
    getCartLines(items).then((r) => { if (live) setLines(r.lines); });
    return () => { live = false; };
    // Se recarga solo cuando cambian las variantes, no en cada cambio de cantidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, items.map((i) => i.variantId).join(",")]);

  if (!ready || lines === null) return <p className="text-ink-soft" role="status">Cargando tu carrito…</p>;
  if (lines.length === 0) {
    return (<div className="card p-8 text-center"><p className="text-lg font-bold">Tu carrito está vacío</p>
      <Link href="/buscar" className="btn btn-primary mt-4">Seguir comprando</Link></div>);
  }

  const qtyOf = (id: string) => items.find((i) => i.variantId === id)?.qty ?? 1;
  const subtotal = lines.reduce((s, l) => s + l.priceCents * qtyOf(l.variantId), 0);
  const problem = lines.some((l) => l.stock < qtyOf(l.variantId));

  return (
    <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
      <ul className="space-y-3">
        {lines.map((l) => {
          const qty = qtyOf(l.variantId);
          return (
            <li key={l.variantId} className="card flex gap-3 p-3">
              <Link href={`/p/${l.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-paper"><ProductImage src={l.image} alt={l.title} sizes="96px" /></Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={`/p/${l.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">{l.title}</Link>
                {l.optionsText && <span className="text-xs text-ink-soft">{l.optionsText}</span>}
                <Price cents={l.priceCents} compareAt={l.compareAtCents} />
                {l.stock < qty && <p className="text-xs font-semibold text-brand-700" role="alert">{l.stock === 0 ? "Agotado: quítalo para continuar." : `Solo hay ${l.stock} disponible(s).`}</p>}
                <div className="mt-auto flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-line" role="group" aria-label="Cantidad">
                    <button className="size-10 text-lg" aria-label="Menos" onClick={() => setQty(l.variantId, qty - 1)}>−</button>
                    <span className="w-7 text-center text-sm font-bold">{qty}</span>
                    <button className="size-10 text-lg" aria-label="Más" onClick={() => setQty(l.variantId, qty + 1)}>+</button>
                  </div>
                  <button className="text-sm font-semibold text-brand-700 underline" onClick={() => remove(l.variantId)}>Quitar</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <aside className="card mt-4 h-fit p-4 lg:sticky lg:top-32 lg:mt-0">
        <h2 className="text-lg font-extrabold">Resumen</h2>
        <p className="mt-2 flex justify-between"><span>Subtotal</span><b>{formatUSD(subtotal)}</b></p>
        <p className="mt-1 text-xs text-ink-soft">El envío se calcula según tu provincia en el siguiente paso. Verás el total final antes de confirmar.</p>
        <Link href="/checkout" aria-disabled={problem} className={`btn btn-primary mt-4 w-full ${problem ? "pointer-events-none opacity-50" : ""}`}>Continuar con la compra</Link>
        <p className="mt-2 text-center text-xs text-ink-soft">No necesitas crear cuenta · Pagas al recibir</p>
      </aside>
    </div>
  );
}
