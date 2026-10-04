"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/store-state";
import { track } from "@/components/pixels";
import { formatUSD } from "@/lib/money";
import { getCartLines, getQuote, placeOrder, type CartLineView } from "../actions";

type Quote = Awaited<ReturnType<typeof getQuote>>;

function Field({ name, label, error, hint, ...rest }: { name: string; label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} className="field" aria-invalid={!!error} aria-describedby={error ? `${name}-e` : undefined} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p id={`${name}-e`} className="mt-1 text-xs font-semibold text-brand-700">{error}</p>}
    </div>
  );
}

export function CheckoutForm({ provinces, freeShippingOverCents }: { provinces: { code: string; name: string }[]; freeShippingOverCents: number }) {
  const { items, ready } = useStore();
  const [state, action, pending] = useActionState(placeOrder, null);
  const [lines, setLines] = useState<CartLineView[] | null>(null);
  const [province, setProvince] = useState("");
  const [quote, setQuote] = useState<Quote>(null);
  const [utm, setUtm] = useState("{}");
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};

  useEffect(() => { if (state?.values?.provinceCode) setProvince(state.values.provinceCode); }, [state]);

  useEffect(() => { try { setUtm(sessionStorage.getItem("chasqui_utm") ?? "{}"); } catch { /* ignorar */ } }, []);

  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) { setLines([]); return; }
    getCartLines(items).then((r) => { setLines(r.lines); track("InitiateCheckout", { value: r.lines.reduce((s, l) => s + l.priceCents * l.qty, 0) / 100, currency: "USD" }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!province || items.length === 0) { setQuote(null); return; }
    let live = true;
    getQuote(items, province).then((q) => { if (live) setQuote(q); });
    return () => { live = false; };
  }, [province, items]);

  if (!ready || lines === null) return <p className="text-ink-soft" role="status">Cargando…</p>;
  if (items.length === 0) return (<div className="card p-8 text-center"><p className="text-lg font-bold">Tu carrito está vacío</p><Link href="/buscar" className="btn btn-primary mt-4">Ver productos</Link></div>);

  const subtotal = lines.reduce((s, l) => s + l.priceCents * (items.find((i) => i.variantId === l.variantId)?.qty ?? 1), 0);
  const blocked = !quote || !quote.hasRates || quote.problems.length > 0;

  return (
    <form action={action} className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="utm" value={utm} />

      <div className="card space-y-4 p-4">
        <h2 className="text-lg font-extrabold">Datos de entrega</h2>
        {state?.error && <p role="alert" className="rounded-lg bg-brand-50 p-3 text-sm font-semibold text-brand-700">{state.error}</p>}
        <Field name="name" defaultValue={v.name} label="Nombre y apellido" autoComplete="name" required error={fe.name} />
        <Field name="idNumber" defaultValue={v.idNumber} label="Cédula o RUC" inputMode="numeric" maxLength={13} required error={fe.idNumber} hint="La usamos para tu factura." />
        <Field name="phone" defaultValue={v.phone} label="Celular (WhatsApp)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0991234567" required error={fe.phone} hint="Te confirmamos y avisamos de tu pedido por WhatsApp." />
        <Field name="email" defaultValue={v.email} label="Correo (opcional)" type="email" autoComplete="email" error={fe.email} />
        <div>
          <label htmlFor="provinceCode" className="label">Provincia</label>
          <select key={`prov-${v.provinceCode ?? ""}`} id="provinceCode" name="provinceCode" className="field" required defaultValue={v.provinceCode ?? ""} onChange={(e) => setProvince(e.target.value)} aria-invalid={!!fe.provinceCode}>
            <option value="">Selecciona…</option>
            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          {fe.provinceCode && <p className="mt-1 text-xs font-semibold text-brand-700">{fe.provinceCode}</p>}
        </div>
        <Field name="city" defaultValue={v.city} label="Ciudad o cantón" autoComplete="address-level2" required error={fe.city} />
        <Field name="address" defaultValue={v.address} label="Dirección" autoComplete="street-address" required error={fe.address} hint="Calle principal, número y calle secundaria." />
        <Field name="reference" defaultValue={v.reference} label="Referencia" required error={fe.reference} hint="Ej.: frente al parque, casa blanca de dos pisos." />
        <div>
          <label htmlFor="notes" className="label">Indicaciones para la entrega (opcional)</label>
          <textarea id="notes" name="notes" rows={2} maxLength={300} defaultValue={v.notes} className="field" />
        </div>
        <div className="rounded-lg bg-paper p-3 text-sm"><b>Forma de pago: contra entrega.</b> Pagas en efectivo al recibir tu pedido.</div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required defaultChecked={v.consent === "on"} className="mt-1 size-5 shrink-0" aria-invalid={!!fe.consent} />
          <span>Acepto el <Link href="/politicas/privacidad" target="_blank" className="underline">aviso de privacidad</Link> y que mis datos se compartan con el proveedor y la empresa de transporte únicamente para entregar mi pedido.</span>
        </label>
        {fe.consent && <p className="text-xs font-semibold text-brand-700">{fe.consent}</p>}
      </div>

      <aside className="card mt-4 h-fit p-4 lg:sticky lg:top-32 lg:mt-0">
        <h2 className="text-lg font-extrabold">Tu pedido</h2>
        <ul className="mt-2 divide-y divide-line text-sm">
          {lines.map((l) => (<li key={l.variantId} className="flex justify-between gap-2 py-2"><span className="min-w-0 truncate">{items.find((i) => i.variantId === l.variantId)?.qty}× {l.title}</span><span>{formatUSD(l.priceCents * (items.find((i) => i.variantId === l.variantId)?.qty ?? 1))}</span></li>))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatUSD(subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{!province ? "Elige tu provincia" : !quote ? "Calculando…" : !quote.hasRates ? "No disponible" : quote.freeShipping ? "Gratis" : formatUSD(quote.shippingCents)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><dt>Total a pagar</dt><dd>{quote && quote.hasRates ? formatUSD(quote.totalCents) : "—"}</dd></div>
        </dl>
        {quote && quote.hasRates && <p className="mt-1 text-xs text-ink-soft">IVA incluido. Entrega estimada: hasta {quote.etaMax} día(s) de transporte tras la preparación.</p>}
        {freeShippingOverCents > 0 && <p className="mt-1 text-xs text-ink-soft">Envío gratis desde {formatUSD(freeShippingOverCents)}.</p>}
        {quote && !quote.hasRates && <p role="alert" className="mt-2 text-xs font-semibold text-brand-700">Aún no tenemos tarifa de envío para esta provincia. Escríbenos por WhatsApp.</p>}
        {quote?.problems.map((p) => <p key={p} role="alert" className="mt-2 text-xs font-semibold text-brand-700">{p}</p>)}
        <button className="btn btn-primary mt-4 w-full" disabled={pending || blocked}>{pending ? "Confirmando…" : "Confirmar pedido"}</button>
        <p className="mt-2 text-center text-xs text-ink-soft">Recibirás un WhatsApp para confirmar. No pagas nada ahora.</p>
      </aside>
    </form>
  );
}
