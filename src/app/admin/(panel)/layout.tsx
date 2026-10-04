import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: { default: "Panel", template: "%s | Panel" }, robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("ADMIN", "OPERATOR");
  const links = [
    ["/admin", "Resumen"], ["/admin/pedidos", "Pedidos"], ["/admin/productos", "Productos"],
    ...(s.role === "ADMIN" ? [["/admin/categorias", "Categorías"], ["/admin/configuracion", "Configuración"]] : []),
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2">
          <Link href="/admin" className="font-black">Chasqui <span className="text-sun-400">Panel</span></Link>
          <nav aria-label="Panel" className="flex flex-1 gap-1 overflow-x-auto">
            {links.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/15">{label}</Link>)}
          </nav>
          <form action={logoutAction}><button className="rounded-lg px-3 py-2 text-sm hover:bg-white/15">Salir ({s.name})</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-5">{children}</main>
    </div>
  );
}
