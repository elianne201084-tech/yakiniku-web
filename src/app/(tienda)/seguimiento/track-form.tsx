"use client";
import { useActionState } from "react";
import { lookupOrder } from "../actions";

export function TrackForm() {
  const [state, action, pending] = useActionState(lookupOrder, null);
  return (
    <form action={action} className="card space-y-4 p-4">
      {state?.error && <p role="alert" className="rounded-lg bg-brand-50 p-3 text-sm font-semibold text-brand-700">{state.error}</p>}
      <div><label htmlFor="number" className="label">Número de pedido</label><input id="number" name="number" defaultValue={state?.number} placeholder="CH-100001" className="field" required autoCapitalize="characters" /></div>
      <div><label htmlFor="last4" className="label">Últimos 4 dígitos de tu celular</label><input id="last4" name="last4" defaultValue={state?.last4} inputMode="numeric" maxLength={4} className="field" required /></div>
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Buscando…" : "Ver mi pedido"}</button>
    </form>
  );
}
