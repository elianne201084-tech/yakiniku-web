"use client";
import Link from "next/link";
import { useStore } from "./store-state";

export function CartLink() {
  const { count, wish, ready } = useStore();
  return (
    <div className="flex items-center gap-1">
      <Link href="/deseos" aria-label={`Lista de deseos${ready ? `, ${wish.length} productos` : ""}`} className="relative grid size-11 place-items-center rounded-full hover:bg-white/15">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-4.6-9.3-9.2C1 8.3 3 5 6.3 5c1.9 0 3.2 1 3.7 2 .5-1 1.8-2 3.7-2 3.3 0 5.3 3.3 3.6 6.8C19 16.4 12 21 12 21Z" /></svg>
        {ready && wish.length > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-sun-500 px-1 text-[11px] font-extrabold text-ink">{wish.length}</span>}
      </Link>
      <Link href="/carrito" aria-label={`Carrito${ready ? `, ${count} productos` : ""}`} className="relative grid size-11 place-items-center rounded-full hover:bg-white/15">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 4h2l2.4 11h10.2l2-8H6.2" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg>
        {ready && count > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-sun-500 px-1 text-[11px] font-extrabold text-ink">{count}</span>}
      </Link>
    </div>
  );
}
