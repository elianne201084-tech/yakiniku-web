"use client";
import { useActionState } from "react";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p role="alert" className="rounded-lg bg-brand-50 p-3 text-sm font-semibold text-brand-700">{state.error}</p>}
      <div><label htmlFor="email" className="label">Correo</label><input id="email" name="email" type="email" defaultValue={state?.email} autoComplete="username" required className="field" /></div>
      <div><label htmlFor="password" className="label">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
