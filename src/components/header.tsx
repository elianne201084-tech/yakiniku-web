import Link from "next/link";
import { getCategoryTree } from "@/modules/catalog";
import { SearchBox } from "./search-box";
import { CartLink } from "./cart-link";

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-black tracking-tight" aria-label="Chasqui Market, inicio">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#f5b700" />
        <path d="M7 20.5 15 8l3 6 7-3-8 13-3-6z" fill="#1b1b2f" />
      </svg>
      <span className={`text-lg sm:text-xl ${light ? "text-white" : "text-ink"}`}>Chasqui <span className="text-sun-400">Market</span></span>
    </Link>
  );
}

export async function Header() {
  const tree = await getCategoryTree();
  return (
    <header className="sticky top-0 z-30 bg-brand-600 text-white shadow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:gap-x-4">
        <details className="group relative">
          <summary aria-label="Categorías" className="grid size-11 cursor-pointer list-none place-items-center rounded-full hover:bg-white/15">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </summary>
          <nav aria-label="Categorías" className="fixed inset-x-0 top-[60px] bottom-0 z-40 overflow-y-auto bg-white p-3 text-ink shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-12 sm:bottom-auto sm:max-h-[75vh] sm:w-80 sm:rounded-xl sm:border sm:border-line">
            <ul>
              {tree.map((c) => (
                <li key={c.id} className="border-b border-line last:border-0">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-2 font-semibold">
                      {c.name}<span aria-hidden className="text-ink-soft">▾</span>
                    </summary>
                    <ul className="pb-2 pl-3">
                      <li><Link className="flex min-h-10 items-center px-2 text-sm font-semibold text-brand-700" href={`/c/${c.path}`}>Ver todo en {c.name}</Link></li>
                      {c.children.map((s) => (
                        <li key={s.id}><Link className="flex min-h-10 items-center px-2 text-sm hover:underline" href={`/c/${s.path}`}>{s.name}</Link></li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </nav>
        </details>
        <Logo />
        <div className="order-last w-full sm:order-none sm:ml-2 sm:w-auto sm:flex-1"><SearchBox /></div>
        <div className="ml-auto sm:ml-0"><CartLink /></div>
      </div>
      <div className="bg-sun-500 px-3 py-1 text-center text-xs font-bold text-ink">Envíos a todo el Ecuador · Pago contra entrega</div>
    </header>
  );
}
