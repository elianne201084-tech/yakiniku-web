"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/store-state";
import { ProductGrid } from "@/components/ui";
import type { ProductCard } from "@/modules/catalog";
import { getWishlist } from "../actions";

export function WishlistView() {
  const { wish, ready } = useStore();
  const [items, setItems] = useState<ProductCard[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    getWishlist(wish).then((r) => { if (live) setItems(r); });
    return () => { live = false; };
  }, [ready, wish]);
  if (items === null) return <p className="text-ink-soft" role="status">Cargando…</p>;
  if (items.length === 0) return (<div className="card p-8 text-center"><p className="text-lg font-bold">Aún no guardas productos</p>
    <p className="mt-1 text-sm text-ink-soft">Toca el corazón en un producto para guardarlo aquí.</p><Link href="/buscar" className="btn btn-primary mt-4">Explorar productos</Link></div>);
  return <ProductGrid items={items} />;
}
