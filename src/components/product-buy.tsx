"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore, MAX_QTY } from "./store-state";
import { track } from "./pixels";
import { Price } from "./ui";
import { waLink } from "@/lib/whatsapp/link";

export type BuyVariant = { id: string; options: Record<string, string>; priceCents: number; compareAtCents: number | null; stock: number };

const KEY_LABEL: Record<string, string> = { talla: "Talla", color: "Color" };

export function ProductBuy({ productId, title, variants, waNumber, url, hasGuide }: {
  productId: string; title: string; variants: BuyVariant[]; waNumber: string; url: string; hasGuide: boolean;
}) {
  const { add, wish, toggleWish } = useStore();
  const keys = useMemo(() => [...new Set(variants.flatMap((v) => Object.keys(v.options)))], [variants]);
  const first = variants.find((v) => v.stock > 0) ?? variants[0];
  const [sel, setSel] = useState<Record<string, string>>(first?.options ?? {});
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const current = variants.find((v) => keys.every((k) => v.options[k] === sel[k]));
  const stock = current?.stock ?? 0;
  const optionAvailable = (key: string, value: string) =>
    variants.some((v) => v.stock > 0 && v.options[key] === value && keys.every((k) => k === key || !sel[k] || v.options[k] === sel[k]));
  const optionExists = (key: string, value: string) =>
    variants.some((v) => v.options[key] === value && keys.every((k) => k === key || !sel[k] || v.options[k] === sel[k]));

  const pick = (key: string, value: string) => {
    const next = { ...sel, [key]: value };
    // Si la combinación no existe, ajusta las demás opciones a la primera variante válida con ese valor.
    if (!variants.some((v) => keys.every((k) => v.options[k] === next[k]))) {
      const fallback = variants.find((v) => v.options[key] === value && v.stock > 0) ?? variants.find((v) => v.options[key] === value);
      if (fallback) return setSel({ ...fallback.options });
    }
    setSel(next);
    setQty(1);
  };

  const label = keys.map((k) => sel[k]).filter(Boolean).join(" / ");
  const wa = waLink(waNumber, `Hola, quiero este producto: ${title}${label ? ` (${label})` : ""}. ${url}`);
  const liked = wish.includes(productId);

  const addToCart = () => {
    if (!current || stock < 1) return;
    add(current.id, qty);
    track("AddToCart", { content_ids: [productId], value: (current.priceCents * qty) / 100, currency: "USD" });
    setAdded(true);
  };

  return (
    <div className="space-y-4">
      {current && <Price cents={current.priceCents} compareAt={current.compareAtCents} size="lg" />}

      {keys.map((k) => (
        <fieldset key={k}>
          <legend className="label flex items-center justify-between">
            <span>{KEY_LABEL[k] ?? k}: <b>{sel[k]}</b></span>
            {k === "talla" && hasGuide && <a href="#guia-tallas" className="text-xs font-semibold text-brand-700 underline">Guía de tallas</a>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {[...new Set(variants.map((v) => v.options[k]).filter(Boolean))].map((val) => {
              const ok = optionAvailable(k, val);
              const active = sel[k] === val;
              return (
                <button key={val} type="button" aria-pressed={active} onClick={() => pick(k, val)} disabled={!optionExists(k, val) && !ok}
                  className={`min-h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold ${active ? "border-ink bg-ink text-white" : "border-line bg-white"} ${!ok ? "opacity-50 line-through" : ""}`}>
                  {val}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p className={`text-sm font-semibold ${stock === 0 ? "text-brand-700" : stock <= 5 ? "text-amber-700" : "text-green-700"}`} aria-live="polite">
        {stock === 0 ? "Agotado en esta opción" : stock <= 5 ? `¡Quedan solo ${stock}!` : "Disponible"}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-line bg-white" role="group" aria-label="Cantidad">
          <button type="button" className="size-11 text-xl" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-8 text-center font-bold" aria-live="polite">{qty}</span>
          <button type="button" className="size-11 text-xl" aria-label="Más" onClick={() => setQty((q) => Math.min(MAX_QTY, stock, q + 1))}>+</button>
        </div>
        <button type="button" onClick={() => toggleWish(productId)} aria-pressed={liked} aria-label={liked ? "Quitar de la lista de deseos" : "Guardar en lista de deseos"}
          className="btn btn-ghost !px-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? "#c8341e" : "none"} stroke="#c8341e" strokeWidth="2" aria-hidden><path d="M12 21s-7-4.6-9.3-9.2C1 8.3 3 5 6.3 5c1.9 0 3.2 1 3.7 2 .5-1 1.8-2 3.7-2 3.3 0 5.3 3.3 3.6 6.8C19 16.4 12 21 12 21Z" /></svg>
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="btn btn-primary" disabled={stock < 1} onClick={addToCart}>Agregar al carrito</button>
        <Link href="/carrito" className={`btn btn-dark ${stock < 1 ? "pointer-events-none opacity-50" : ""}`}
          onClick={() => { if (current && stock > 0) add(current.id, qty); }}>Comprar ahora</Link>
      </div>
      {added && <p role="status" className="rounded-lg bg-green-50 p-2 text-sm text-green-800">Agregado al carrito. <Link href="/carrito" className="font-bold underline">Ver carrito</Link></p>}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa w-full">Preguntar por WhatsApp</a>}
    </div>
  );
}
