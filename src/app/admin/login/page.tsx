import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/header";

export const metadata: Metadata = { title: "Ingreso al panel", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <div className="rounded-2xl bg-brand-600 p-4"><Logo /></div>
      <div className="card p-5">
        <h1 className="mb-4 text-xl font-extrabold">Ingreso al panel</h1>
        {error === "permiso" && <p role="alert" className="mb-3 rounded-lg bg-brand-50 p-3 text-sm font-semibold text-brand-700">Tu usuario no tiene permiso para esa sección.</p>}
        <LoginForm />
      </div>
    </div>
  );
}
